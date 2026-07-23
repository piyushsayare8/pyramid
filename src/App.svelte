<script>
  import { onMount, onDestroy, untrack } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  // ─── Supabase Client ────────────────────────────────────────────────
  const SUPABASE_URL = "https://conecotzzmloenikxefo.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvbmVjb3R6em1sb2VuaWt4ZWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTg5NzksImV4cCI6MjA5ODI3NDk3OX0.M5llBovp2kS6s83ZOIxETYKoRl6dFcF-96Fkc53XHQM";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ─── CDN Base URL ───────────────────────────────────────────────────
  const CDN_BASE = "https://data.creatorspyramid.com";

  // ─── Constants ───────────────────────────────────────────────────────
  export const TOTAL_PLACES = 100000;

  const YT_REGEX =
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const YT_DEFAULT_ID = "jfKfPfyJRdk";

  // Memoized YouTube ID extraction — O(1) cache hit
  const _ytCache = Object.create(null);
  function getYoutubeVidId(url) {
    if (!url) return YT_DEFAULT_ID;
    if (_ytCache[url] !== undefined) return _ytCache[url];
    const m = url.match(YT_REGEX);
    const id = m && m[2] && m[2].length === 11 ? m[2] : YT_DEFAULT_ID;
    _ytCache[url] = id;
    return id;
  }

  // Price computation — pure, cacheable
  function getPriceForId(id) {
    return +(1 + (id - 1) * 0.03).toFixed(2);
  }

  function getIdForPrice(price) {
    return Math.round((price - 1) / 0.03) + 1;
  }

  // Price formatting with memoization for hot-path cards
  const _priceCache = Object.create(null);
  function formatPrice(price) {
    if (_priceCache[price] !== undefined) return _priceCache[price];
    let result;
    if (Number.isInteger(price)) {
      result = price.toLocaleString("en-IN");
    } else {
      const parts = price.toFixed(2).split(".");
      parts[0] = Number(parts[0]).toLocaleString("en-IN");
      result = parts.join(".");
    }
    _priceCache[price] = result;
    return result;
  }

  function formatLikes(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n || 0);
  }

  // Pre-compute all derived display properties on an item — called ONCE per item
  function enrichItem(raw) {
    const place = raw.place;
    const id = raw.id || place;
    const name = raw.name_on_card || raw.name || "Anonymous";
    const message = raw.message_on_card || raw.message || "—";
    const youtubeUrl = raw.youtube_url || raw.youtubeUrl || "";
    const instagramUrl = raw.instagram_social_url || raw.instagramUrl || "";
    const paymentId = raw.payment_id || id;
    const profilePicture =
      raw.profile_image_upload || raw.profile_image || raw.profilePicture || "";
    const likes = raw._likeCount ?? raw.total_like_count ?? raw.likes ?? 0;
    const ytId = getYoutubeVidId(youtubeUrl);
    const price = getPriceForId(parseInt(id, 10) || 1);
    const encodedName = encodeURIComponent(name);

    // Image fallback chain: profile_image_upload -> CDN /profiles/{payment_id}.jpeg -> ui-avatars
    const cdnImageFallback = `${CDN_BASE}/profiles/${paymentId}.jpeg`;
    const uiAvatarPrimary = `https://ui-avatars.com/api/?name=${encodedName}&background=7c3aed&color=fff&size=200`;
    const uiAvatarFallback = `https://ui-avatars.com/api/?name=${encodedName}&background=333&color=fff&size=200`;

    return {
      ...raw,
      id,
      place,
      name,
      message,
      youtubeUrl,
      instagramUrl,
      profilePicture,
      likes,
      _ytId: ytId,
      _thumbUrl: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
      _thumbFallback: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      _avatarSrc: profilePicture || cdnImageFallback,
      _avatarFallback1: profilePicture ? cdnImageFallback : uiAvatarPrimary,
      _avatarFallback2: uiAvatarFallback,
      _price: price,
      _formattedPrice: formatPrice(price),
      _placeFormatted: place.toLocaleString("en-IN"),
      _rawMsg: message,
      _isShortMsg: message.length <= 85,
      _msgPreview:
        message.length > 85 ? message.slice(0, 85).trim() + "..." : null,
    };
  }

  // ─── Debounce utility ────────────────────────────────────────────────
  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ─── Heart animation pool (reuse DOM elements) ──────────────────────
  const HEART_POOL_SIZE = 20;
  let heartPool = [];
  let heartPoolReady = false;

  function initHeartPool() {
    if (heartPoolReady) return;
    for (let i = 0; i < HEART_POOL_SIZE; i++) {
      const heart = document.createElement("div");
      heart.className = "floating-heart";
      heart.style.display = "none";
      heart.style.willChange = "transform, opacity";
      document.body.appendChild(heart);
      heartPool.push(heart);
    }
    heartPoolReady = true;
  }

  function throwHearts(element) {
    if (!element) return;
    initHeartPool();
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 + window.scrollX;
    const centerY = rect.top + rect.height / 2 + window.scrollY;

    const heartsToUse = Math.min(10, heartPool.length);
    for (let i = 0; i < heartsToUse; i++) {
      const heart = heartPool[i];
      if (!heart) continue;

      heart.textContent = Math.random() > 0.5 ? "❤️" : "💖";
      heart.style.left = `${centerX}px`;
      heart.style.top = `${centerY}px`;
      heart.style.display = "block";

      const angle = ((Math.random() * 120 + 30) * Math.PI) / 180;
      const velocity = 60 + Math.random() * 80;
      const tx = Math.cos(angle) * velocity;
      const ty = -Math.sin(angle) * velocity;

      heart.style.setProperty("--tx", `${tx}px`);
      heart.style.setProperty("--ty", `${ty}px`);
      heart.style.fontSize = `${14 + Math.random() * 14}px`;

      // Reset animation by removing and re-adding class
      heart.classList.remove("floating-heart");
      // Force reflow on this single element (unavoidable for animation restart)
      void heart.offsetWidth;
      heart.classList.add("floating-heart");

      // Hide after animation (matches CSS duration)
      const hideTimer = setTimeout(() => {
        heart.style.display = "none";
        clearTimeout(hideTimer);
      }, 1200);
    }
  }

  // ─── Svelte 5 Runes State ───────────────────────────────────────────

  // ─── Master Data (single like.json — ids sorted by newest/price) ────
  let masterIds = $state([]); // [id, id, ...] from like.json — already sorted by newest
  let masterLikes = $state([]); // [likeCount, ...] — same index as masterIds
  let likesMap = new Map(); // Map<id, likeCount> — fast lookup
  let _masterETag = ''; // ETag for SWR revalidation
  let shuffledIds = []; // Fisher-Yates shuffled copy for random tab
  let indexesLoaded = $state(false);

  // $derived: sorted-by-likes view (only computed when masterIds/masterLikes change)
  let sortedByLikes = $derived.by(() => {
    if (masterIds.length === 0) return [];
    const indices = Array.from({ length: masterIds.length }, (_, i) => i);
    indices.sort((a, b) => (masterLikes[b] || 0) - (masterLikes[a] || 0));
    return indices.map(i => masterIds[i]);
  });

  // Core data: Map<placeNumber, enrichedItem> — only holds the current window
  let itemsMap = $state(new Map());
  let itemsVersion = $state(0);

  // Sort UI state — "newest" = masterIds, "top_liked" = sortedByLikes, "random" = shuffled
  let currentSort = $state("newest");

  // Search UI state — kept for future server integration (no local filtering)
  let searchQuery = $state("");
  let likedSet = $state(new Set());
  let maxLikesMap = {}; // Maps id -> max known likes
  // Tracks IDs whose like has been sent to Supabase (permanent, never toggle)
  let sentLikesSet = $state(new Set());
  let expandedMessages = $state(new Set());
  let theme = $state("light");
  let buyModalOpen = $state(false);
  let activeVideoPlace = $state(null);
  let activeVideoId = $state(null);

  let paymentData = $state({
    paymentLink: "https://rzp.io/l/web100k_payment",
    amount: 99,
  });

  // Form Signals
  let formName = $state("");
  let formProfile = $state("");
  let formYoutube = $state("");
  let formMsg = $state("");

  // Counter animation state
  let displayRemaining = $state(99990);

  // Virtual Scrolling State
  let scrollTop = $state(0);
  let viewportHeight = $state(800);
  let columns = $state(4);
  let gridTopOffset = $state(0);
  let gridRef = $state(null);
  let rafId = null;
  let isOnCard = false;

  // Scroll RAF batching
  let _scrollRafPending = false;

  // Persistence debounce
  let _persistTimer = null;

  // ─── Sliding Window Constants ──────────────────────────────────────
  const WINDOW_SIZE = 40; // max user cards fetched at a time
  const FETCH_AHEAD = 10; // fetch this many beyond visible range
  const USER_CACHE_MAX = 100; // max entries in userCache before eviction
  let userCache = new Map(); // Map<id, userData> — LRU-ish cache
  let _windowFetchTimer = null; // debounce for scroll-driven fetching
  let _currentFetchAbort = null; // abort previous window fetch

  // ─── Active IDs — derived from current tab ─────────────────────────
  function getActiveIds() {
    if (currentSort === "top_liked") return sortedByLikes;
    if (currentSort === "random") return shuffledIds;
    return masterIds; // "newest" — already sorted by descending ID
  }

  // Total items count for the current tab (drives virtual scroll height)
  let totalItemCount = $derived.by(() => {
    void itemsVersion; // re-derive when data changes
    return getActiveIds().length;
  });

  // ─── Virtual Scroll Engine (Spacer Method) ──────────────────────
  let ESTIMATED_ROW_HEIGHT = $derived(columns === 1 ? 600 : 524);
  const OVERSCAN_ROWS = 3;

  let totalRows = $derived(Math.ceil(totalItemCount / columns));
  let relativeScrollTop = $derived(Math.max(0, scrollTop - gridTopOffset));

  let startRow = $derived(Math.max(0, Math.floor(relativeScrollTop / ESTIMATED_ROW_HEIGHT) - OVERSCAN_ROWS));
  let endRow = $derived(Math.min(totalRows, Math.ceil((relativeScrollTop + viewportHeight) / ESTIMATED_ROW_HEIGHT) + OVERSCAN_ROWS));

  let startIndex = $derived(startRow * columns);
  let endIndex = $derived(endRow * columns);

  let paddingTop = $derived(startRow * ESTIMATED_ROW_HEIGHT);
  let paddingBottom = $derived(Math.max(0, (totalRows - endRow) * ESTIMATED_ROW_HEIGHT));

  // ─── Build visible cards from activeIds + itemsMap ──────────────────
  let visibleCards = $derived.by(() => {
    void itemsVersion;
    const ids = getActiveIds();
    const cards = [];
    for (let i = Math.max(0, startIndex); i < endIndex && i < ids.length; i++) {
      const place = i + 1;
      const id = ids[i];
      const item = itemsMap.get(place);
      if (item) {
        cards.push(item);
      } else {
        // Skeleton placeholder — not yet fetched
        cards.push({
          id: id,
          place: place,
          name: "Loading...",
          message: "",
          likes: likesMap.get(id) ?? 0,
          profilePicture: "",
          youtubeUrl: "",
          instagramUrl: "",
          _skeleton: true,
          _ytId: YT_DEFAULT_ID,
          _thumbUrl: "",
          _thumbFallback: "",
          _avatarSrc: "",
          _avatarFallback1: "",
          _avatarFallback2: "",
          _price: getPriceForId(parseInt(id, 10) || 1),
          _formattedPrice: formatPrice(getPriceForId(parseInt(id, 10) || 1)),
          _placeFormatted: place.toLocaleString("en-IN"),
          _rawMsg: "",
          _isShortMsg: true,
          _msgPreview: null,
        });
      }
    }
    return cards;
  });

  // ─── RAF-batched scroll handler ─────────────────────────────────────
  function handleScroll() {
    if (_scrollRafPending) return;
    _scrollRafPending = true;
    requestAnimationFrame(() => {
      scrollTop = window.scrollY || document.documentElement.scrollTop;
      _scrollRafPending = false;
      // Trigger windowed fetch for newly visible range
      loadWindowForScroll();
      updateVideoPosition();
    });
  }

  // ─── Debounced resize handler ───────────────────────────────────────
  const handleResize = debounce(() => {
    viewportHeight = window.innerHeight;
    const w = window.innerWidth;
    if (w <= 640) columns = 1;
    else if (w <= 1024) columns = 2;
    else if (w <= 1280) columns = 3;
    else columns = 4;
    if (gridRef) gridTopOffset = gridRef.offsetTop;
    updateVideoPosition();
  }, 150);

  // ─── Search input — UI only, filtering will be server-side ──────────
  function handleSearchInput(e) {
    searchQuery = e.currentTarget.value;
    // TODO: will send search query to server when API is ready
  }

  function clearSearch() {
    searchQuery = "";
  }

  // ─── Theme toggle ──────────────────────────────────────────────────
  function toggleThemeMode() {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("top15000_theme", theme);
  }

  function setSortOption(sortBy) {
    if (currentSort === sortBy) return;
    currentSort = sortBy;
    if (sortBy === "random") {
      // Shuffle from master IDs
      shuffledIds = [...masterIds];
      for (let i = shuffledIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
      }
    }
    // Clear current items and re-load window for the new tab
    // Cancel any in-flight fetches from the previous tab
    if (_currentFetchAbort) _currentFetchAbort.abort();
    itemsMap.clear();
    expandedMessages = new Set(); // reset expansions on tab switch
    itemsVersion++;
    loadWindowForScroll();
  }

  // ─── Fetch individual user data from CDN ────────────────────────────
  async function fetchUserData(id, signal) {
    try {
      const res = await fetch(`${CDN_BASE}/users/${id}.json`, {
        cache: "no-cache",
        signal,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      if (err.name === "AbortError") return null; // expected on tab switch
      console.error(`Error fetching user ${id}:`, err);
      return null;
    }
  }

  // ─── Debounced persistence (lightweight — only likes + sent likes) ─
  function schedulePersist() {
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      try {
        localStorage.setItem("top15000_liked", JSON.stringify([...likedSet]));
        localStorage.setItem(
          "top15000_sent_likes",
          JSON.stringify([...sentLikesSet]),
        );
        localStorage.setItem("top15000_max_likes", JSON.stringify(maxLikesMap));
      } catch {}
    }, 1000);
  }

  // Helper to get or create device fingerprint
  function getDeviceId() {
    let deviceId = localStorage.getItem("device_fingerprint");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("device_fingerprint", deviceId);
    }
    return deviceId;
  }

  // ─── Like toggle — allows like/unlike in UI, but Supabase RPC fires only once ever ──
  function toggleLikeItem(placeNum, btnElement) {
    const item = itemsMap.get(placeNum);
    if (!item) return;

    const idToLike = item.id || placeNum;
    const isCurrentlyLiked = likedSet.has(idToLike);

    if (isCurrentlyLiked) {
      // Unlike — UI only, never touches Supabase
      likedSet.delete(idToLike);
      const updatedItem = {
        ...item,
        likes: Math.max(0, (item.likes || 0) - 1),
      };
      itemsMap.set(placeNum, updatedItem);
      likesMap.set(idToLike, updatedItem.likes);
      maxLikesMap[idToLike] = updatedItem.likes;
      itemsVersion++;
    } else {
      // Like — increment UI count
      likedSet.add(idToLike);
      const updatedItem = {
        ...item,
        likes: (item.likes || 0) + 1,
      };
      itemsMap.set(placeNum, updatedItem);
      likesMap.set(idToLike, updatedItem.likes);
      maxLikesMap[idToLike] = updatedItem.likes;
      itemsVersion++;

      if (btnElement) {
        throwHearts(btnElement);
      }

      // Only send to Supabase if we haven't sent for this ID before
      if (!sentLikesSet.has(idToLike)) {
        sentLikesSet.add(idToLike);

        supabase
          .rpc("process_card_like", {
            target_id: idToLike,
            client_device_id: getDeviceId(),
          })
          .then(({ error }) => {
            if (error)
              console.error("Error sending like to Supabase:", error.message);
          })
          .catch((err) =>
            console.error("Error sending like to Supabase:", err),
          );
      }
    }

    // Debounced persistence
    schedulePersist();
  }

  // ─── Message expand/collapse ────────────────────────────────────────
  function toggleMsgExpand(item, expand) {
    if (expand) {
      expandedMessages.add(item.place);
    } else {
      expandedMessages.delete(item.place);
    }
    expandedMessages = new Set(expandedMessages); // force Svelte 5 reactivity
  }

  // ─── Toast ──────────────────────────────────────────────────────────
  let _toastTimer;
  function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
  }

  // ─── Video Player — IntersectionObserver + RAF only when transitioning
  let _videoObserver = null;
  let _videoInView = false;

  function setupVideoObserver() {
    if (_videoObserver) _videoObserver.disconnect();
    _videoObserver = null;
  }

  function updateVideoPosition() {
    const placeNum = activeVideoPlace;
    if (placeNum === null) return;

    const wrap = document.getElementById(`video-wrap-${placeNum}`);
    const player = document.getElementById("lb-global-mini-player");
    if (!player) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let inView = false;
    let rect = null;

    if (wrap) {
      rect = wrap.getBoundingClientRect();
      inView =
        rect.top >= -20 &&
        rect.bottom <= vh + 20 &&
        rect.top < vh - 30 &&
        rect.width > 0;
    }

    if (inView && rect) {
      player.style.cssText = `
        position: fixed;
        top: ${Math.max(0, rect.top)}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        bottom: auto;
        right: auto;
        border-radius: 23.5px 23.5px 0 0;
        border: none;
        box-shadow: none;
        opacity: 1;
        transform: none;
        transition: none;
        pointer-events: all;
      `;
      if (!isOnCard) {
        player.classList.add("lbmp-on-card");
        player.classList.remove("lbmp-floating");
        isOnCard = true;
      }
    } else {
      const floatW = vw <= 640 ? 260 : 352;
      const bottom = vw <= 640 ? "16px" : "28px";
      const right = vw <= 640 ? "16px" : "28px";
      player.style.cssText = `
        position: fixed;
        top: auto;
        left: auto;
        bottom: ${bottom};
        right: ${right};
        width: ${floatW}px;
        height: auto;
        border: 2.5px solid var(--pop-border, #4338ca);
        box-shadow: 0 24px 60px rgba(0,0,0,0.8);
        border-radius: 20px;
        opacity: 1;
        transform: none;
        transition: bottom 0.4s cubic-bezier(0.16,1,0.3,1), right 0.4s cubic-bezier(0.16,1,0.3,1), width 0.38s cubic-bezier(0.16,1,0.3,1), border-radius 0.35s ease, box-shadow 0.3s ease;
        pointer-events: all;
      `;
      if (isOnCard) {
        player.classList.remove("lbmp-on-card");
        player.classList.add("lbmp-floating");
        isOnCard = false;
      }
    }
  }

  // Track previous video position state to avoid infinite RAF
  let _lastVideoState = null;

  function playVideo(event, placeNum, vidId) {
    if (event) event.stopPropagation();
    activeVideoPlace = placeNum;
    activeVideoId = vidId;

    const screen = document.getElementById("lbmp-screen");
    const titleEl = document.getElementById("lbmp-title");

    if (screen && !screen.querySelector(`iframe[data-vid="${vidId}"]`)) {
      screen.innerHTML = `<iframe data-vid="${vidId}" src="https://www.youtube.com/embed/${vidId}?autoplay=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;display:block;"></iframe>`;
    }
    if (titleEl) titleEl.textContent = `▶ Place #${placeNum}`;

    const player = document.getElementById("lb-global-mini-player");
    if (player) {
      player.style.opacity = "1";
      player.style.transform = "none";
      player.style.pointerEvents = "all";
    }

    isOnCard = false;
    if (rafId) cancelAnimationFrame(rafId);
    _lastVideoState = null;
    updateVideoPosition();
  }

  function closePlayer() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    const screen = document.getElementById("lbmp-screen");
    if (screen) screen.innerHTML = "";

    const player = document.getElementById("lb-global-mini-player");
    if (player) {
      player.style.opacity = "0";
      player.style.transform = "translateY(20px) scale(0.92)";
      player.style.pointerEvents = "none";
    }
    activeVideoPlace = null;
    activeVideoId = null;
    isOnCard = false;
  }

  function scrollToActiveCard() {
    if (activeVideoPlace === null) return;
    const row = document.getElementById(`row-${activeVideoPlace}`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ─── Derived stats ─────────────────────────────────────────────────
  let displayPrice = $derived(
    paymentData.amount !== null
      ? paymentData.amount
      : getPriceForId((masterIds.length || itemsMap.size) + 1),
  );
  let nextId = $derived(getIdForPrice(displayPrice));
  
  let soldCount = $derived(Math.max(0, nextId - 1));
  let remainingCount = $derived(TOTAL_PLACES - soldCount);
  let progressPct = $derived(Math.max((soldCount / TOTAL_PLACES) * 100, 0.2));

  let displayPriceFormatted = $derived(formatPrice(displayPrice));
  let nextAfterId = $derived(nextId + 1);
  let nextAfterPrice = $derived(formatPrice(getPriceForId(nextAfterId)));
  let isSoldOut = $derived(nextId > TOTAL_PLACES);

  // Pre-formatted values for buy section (avoid repeated toLocaleString)
  let nextPlaceFormatted = $derived(nextId.toLocaleString("en-IN"));
  let nextAfterPlaceFormatted = $derived(nextAfterId.toLocaleString("en-IN"));

  // ─── Buy form submit ───────────────────────────────────────────────
  function handleBuySubmit(e) {
    if (e) e.preventDefault();

    if (paymentData.paymentLink) {
      window.location.href = paymentData.paymentLink;
      return;
    }

    showToast(
      "Payment link is not available right now. Please try again later.",
    );
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────
  let pollInterval;
  let indexPollInterval;

  async function loadPaymentData() {
    try {
      const response = await fetch(
        "https://data.creatorspyramid.com/active-link.json",
        { cache: "no-cache" },
      );
      if (response.ok) {
        const data = await response.json();
        const link = data.paymentLink || data.payment_link || "";
        const amt =
          data.amount !== undefined
            ? data.amount
            : data.price !== undefined
              ? data.price
              : null;
        if (paymentData.paymentLink !== link || paymentData.amount !== amt) {
          paymentData.paymentLink = link;
          paymentData.amount = amt;
        }
      }
    } catch (err) {
      console.error("Error loading payment data from active-link.json:", err);
    }
  }

  // ─── SWR Fetch: Single Master JSON (like.json) with ETag ───────────
  async function fetchMasterData() {
    try {
      // 1. SWR: Instant load from localStorage (serve stale)
      if (masterIds.length === 0) {
        try {
          const cached = JSON.parse(localStorage.getItem('master_data') || 'null');
          if (cached && cached.ids && cached.likes) {
            applyMasterData(cached.ids, cached.likes);
          }
        } catch {}
      }

      // 2. Background revalidate with ETag
      const headers = {};
      if (_masterETag) headers['If-None-Match'] = _masterETag;

      const res = await fetch(`${CDN_BASE}/like.json`, { headers, cache: 'no-store' });

      if (res.status === 304) return; // Not modified — stale data is still fresh
      if (!res.ok) return;

      const etag = res.headers.get('etag');
      if (etag) _masterETag = etag;

      const data = await res.json();
      applyMasterData(data.ids || [], data.likes || []);

      // Persist to localStorage for next SWR cycle
      try {
        localStorage.setItem('master_data', JSON.stringify(data));
        if (etag) localStorage.setItem('master_etag', etag);
      } catch {}

    } catch (err) {
      console.error('Error fetching master data:', err);
    }
  }

  // Apply master JSON data to all state
  function applyMasterData(ids, likes) {
    masterIds = ids;
    masterLikes = likes;
    likesMap.clear();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const serverLikes = likes[i] || 0;
      // Optimistic max likes — never drop below user's local high-water mark
      if (maxLikesMap[id] !== undefined && maxLikesMap[id] > serverLikes) {
        likesMap.set(id, maxLikesMap[id]);
      } else {
        likesMap.set(id, serverLikes);
        maxLikesMap[id] = serverLikes;
      }
    }
    schedulePersist();

    indexesLoaded = true;

    // Update items that are already loaded with fresh like counts
    for (const [place, item] of itemsMap) {
      const freshLikes = likesMap.get(item.id) ?? item.likes;
      if (freshLikes !== item.likes) {
        itemsMap.set(place, { ...item, likes: freshLikes });
      }
    }
    itemsVersion++;

    // Trigger initial window load
    loadWindowForScroll();
  }

  // ─── Sliding Window: fetch user cards for the visible range ────────
  function loadWindowForScroll() {
    clearTimeout(_windowFetchTimer);
    _windowFetchTimer = setTimeout(() => _loadWindow(), 80);
  }

  async function _loadWindow() {
    const ids = getActiveIds();
    if (ids.length === 0) return;

    const cols = columns;
    const startItem = Math.max(0, startRow * cols - FETCH_AHEAD);
    const endItem = Math.min(ids.length, endRow * cols + FETCH_AHEAD);

    // Collect IDs that need fetching (not in itemsMap for their place)
    const toFetch = [];
    for (let i = startItem; i < endItem; i++) {
      const place = i + 1;
      if (!itemsMap.has(place)) {
        const id = ids[i];
        if (userCache.has(id)) {
          // Serve from cache instantly
          const cached = userCache.get(id);
          const enriched = enrichItem({
            ...cached,
            id: cached.id ?? id,
            place,
            _likeCount: likesMap.get(cached.id ?? id) ?? 0,
          });
          itemsMap.set(place, enriched);
        } else {
          toFetch.push({ idx: i, id: ids[i], place: i + 1 });
        }
      }
    }

    // If all served from cache, just bump version
    if (toFetch.length === 0) {
      evictOutOfWindow(startItem, endItem);
      itemsVersion++;
      return;
    }

    // Abort any previous in-flight fetch batch
    if (_currentFetchAbort) _currentFetchAbort.abort();
    const controller = new AbortController();
    _currentFetchAbort = controller;

    // Batch fetch missing user cards in parallel
    const results = await Promise.all(
      toFetch.map((entry) => fetchUserData(entry.id, controller.signal)),
    );

    // If this batch was aborted (tab switched), bail out
    if (controller.signal.aborted) return;

    for (let i = 0; i < toFetch.length; i++) {
      const userData = results[i];
      if (!userData) continue;

      const entry = toFetch[i];
      const id = userData.id ?? entry.id;

      // Store in userCache
      userCache.set(id, userData);

      // Enrich and put in itemsMap
      const enriched = enrichItem({
        ...userData,
        id,
        place: entry.place,
        _likeCount: likesMap.get(id) ?? 0,
      });
      itemsMap.set(entry.place, enriched);
    }

    // Evict items far outside the window to keep memory flat
    evictOutOfWindow(startItem, endItem);

    // Evict userCache if it's too large
    if (userCache.size > USER_CACHE_MAX) {
      const keys = Array.from(userCache.keys());
      const toRemove = keys.length - USER_CACHE_MAX;
      for (let i = 0; i < toRemove; i++) {
        userCache.delete(keys[i]);
      }
    }

    itemsVersion++;
  }

  // Evict items from itemsMap that are far outside the visible window
  function evictOutOfWindow(startItem, endItem) {
    const buffer = WINDOW_SIZE; // keep a buffer around the window
    const keepStart = Math.max(1, startItem + 1 - buffer);
    const keepEnd = endItem + buffer;
    for (const [place] of itemsMap) {
      if (place < keepStart || place > keepEnd) {
        itemsMap.delete(place);
      }
    }
  }

  onMount(() => {
    loadPaymentData();
    // Restore ETag from localStorage for SWR
    _masterETag = localStorage.getItem('master_etag') || '';
    fetchMasterData(); // Single master JSON with SWR
    pollInterval = setInterval(loadPaymentData, 30000);
    indexPollInterval = setInterval(fetchMasterData, 60000);

    // Restore liked set — populate in-place to preserve $state proxy
    try {
      const savedLiked = JSON.parse(
        localStorage.getItem("top15000_liked") || "[]",
      );
      likedSet.clear();
      for (const id of savedLiked) likedSet.add(id);
    } catch {}

    // Restore max likes map
    try {
      maxLikesMap = JSON.parse(
        localStorage.getItem("top15000_max_likes") || "{}",
      );
    } catch {}

    // Restore sent likes set (permanent record of Supabase-sent likes)
    try {
      const savedSent = JSON.parse(
        localStorage.getItem("top15000_sent_likes") || "[]",
      );
      sentLikesSet.clear();
      for (const id of savedSent) sentLikesSet.add(id);
    } catch {}

    // Restore theme
    const savedTheme = localStorage.getItem("top15000_theme") || "light";
    theme = savedTheme;
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Ambient background
    const bgEl = document.getElementById("user-ambient-bg");
    if (bgEl) {
      const colors = [
        "#7c3aed",
        "#e91e8c",
        "#0d9488",
        "#f59e0b",
        "#2563eb",
        "#dc2626",
        "#16a34a",
        "#9333ea",
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      bgEl.style.background = `radial-gradient(circle at 50% 50%, #ffffff 0%, ${randomColor} 70%)`;
    }

    // Viewport setup
    viewportHeight = window.innerHeight;
    const w = window.innerWidth;
    if (w <= 640) columns = 1;
    else if (w <= 1024) columns = 2;
    else columns = 3;
    scrollTop = window.scrollY || document.documentElement.scrollTop;

    // Deferred: compute grid offset after layout
    requestAnimationFrame(() => {
      if (gridRef) gridTopOffset = gridRef.offsetTop;
    });
  });

  // Animate remaining places counter smoothly whenever remainingCount updates
  $effect(() => {
    const target = remainingCount;
    const currentDisplay = untrack(() => displayRemaining);
    const diff = target - currentDisplay;
    if (diff !== 0) {
      const start = currentDisplay;
      const duration = 800;
      const startTime = performance.now();
      let _animRafId;
      function step(now) {
        const p = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        displayRemaining = Math.round(start + diff * eased);
        if (p < 1) _animRafId = requestAnimationFrame(step);
      }
      _animRafId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(_animRafId);
    }
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
    clearTimeout(_persistTimer);
    clearTimeout(_windowFetchTimer);
    if (_videoObserver) _videoObserver.disconnect();
    clearInterval(pollInterval);
    clearInterval(indexPollInterval);
  });
</script>

<svelte:window onscroll={handleScroll} onresize={handleResize} />

<div class="main-wrap">
  <!-- THEME TOGGLE BUTTON -->
  <button
    class="theme-toggle-btn"
    id="theme-toggle-btn"
    onclick={toggleThemeMode}
    title="Switch Dark / Light Mode"
    aria-label="Toggle Theme"
  >
    <span class="theme-icon">{theme === "dark" ? "☀️" : "🌙"}</span>
  </button>

  <!-- AMBIENT LIVING ATMOSPHERE -->
  <div class="user-ambient-wrapper">
    <div id="user-ambient-bg" class="user-ambient-bg"></div>
  </div>

  <!-- HERO HEADER -->
  <header class="site-header">
    <div class="site-logo">
      <span class="logo-text">web<span class="logo-accent">100k</span>.com</span
      >
    </div>
  </header>

  <!-- HERO GRID CONTAINER -->
  <div class="hero-grid-container">
    <!-- COUNTER SECTION -->
    <section class="counter-section" id="counter-section">
      <div class="counter-label">Places Remaining On The Leaderboard</div>
      <div class="counter-display">
        <span class="counter-number" id="places-remaining">
          {displayRemaining.toLocaleString("en-IN")}
        </span>
        <span class="counter-total">/ 1,00,000</span>
      </div>
      <div class="counter-progress-wrap">
        <div class="counter-progress-bar">
          <div
            class="counter-progress-fill"
            id="counter-progress-fill"
            style="width: {progressPct}%;"
          ></div>
        </div>
        <div class="counter-progress-labels">
          <span>0</span>
          <span id="places-sold-label">{soldCount} sold</span>
          <span>1,00,000</span>
        </div>
      </div>
      <div class="counter-special-notice">
        <span class="notice-icon">🎁</span>
        <span class="notice-text">
          Once it completed all the users will received the{" "}
          <strong>web100k.com special card</strong> for them to their home!
        </span>
      </div>
    </section>

    <!-- BUY SECTION -->
    <section class="buy-section" id="buy-section">
      <div class="buy-card">
        <div class="buy-card-glow"></div>
        <div class="buy-place-badge">
          <span class="buy-place-number">
            Place #<span id="current-place-number">{nextPlaceFormatted}</span>
          </span>
          <span class="buy-exclusive-tag">⚡ Available Now</span>
        </div>
        <div class="buy-price-display">
          <span class="buy-currency">₹</span>
          <span class="buy-price-amount" id="current-price"
            >{displayPriceFormatted}</span
          >
        </div>
        <p class="buy-description">
          Secure <strong
            >Place #<span id="buy-place-desc">{nextPlaceFormatted}</span
            ></strong
          >
          forever on web100k.com.<br />
          Your name, message &amp; photo — permanently on the internet.
        </p>
        <div class="buy-features">
          <div class="buy-feature">
            <span class="feat-icon">🏆</span> Permanent leaderboard entry
          </div>
          <div class="buy-feature">
            <span class="feat-icon">♾️</span> Your place, forever
          </div>
          <div class="buy-feature">
            <span class="feat-icon">🌐</span> Visible to everyone
          </div>
        </div>
        <button
          class="buy-btn"
          id="buy-btn"
          onclick={() => !isSoldOut && handleBuySubmit()}
          disabled={isSoldOut}
          style={isSoldOut ? "opacity: 0.6; cursor: default;" : ""}
        >
          {#if isSoldOut}
            <span>🎉 All 1,00,000 Places Sold!</span>
          {:else}
            <span class="buy-btn-icon">⚡</span>
            <span>
              Claim Place #<span id="buy-btn-place">{nextPlaceFormatted}</span>
              for ₹<span id="buy-btn-price">{displayPriceFormatted}</span>
            </span>
            <span class="buy-btn-arrow">→</span>
          {/if}
        </button>
        <div class="buy-urgency">
          <div class="urgency-dot"></div>
          <span id="buy-urgency-text">
            Next available spot: Place #{nextAfterPlaceFormatted}
            for ₹{nextAfterPrice}
          </span>
        </div>
      </div>
    </section>
  </div>

  <!-- LEADERBOARD SECTION -->
  <section class="leaderboard-section" id="leaderboard-section">
    <div class="lb-header">
      <div class="lb-title-wrap">
        <h2 class="lb-title">✨ The Permanent 100,000 Leaderboard</h2>
        <p class="lb-subtitle">
          Every name, message & photo — permanently displayed on the internet
        </p>
      </div>
      <div class="lb-controls">
        <div class="lb-sort-group">
          <span class="lb-sort-label">Sort by</span>
          <button
            class="lb-sort-btn {currentSort === 'newest' ? 'active' : ''}"
            onclick={() => setSortOption("newest")}
          >
            🆕 Newest
          </button>
          <button
            class="lb-sort-btn {currentSort === 'top_liked' ? 'active' : ''}"
            onclick={() => setSortOption("top_liked")}
          >
            🔥 Top Liked
          </button>
          <button
            class="lb-sort-btn {currentSort === 'random' ? 'active' : ''}"
            onclick={() => setSortOption("random")}
          >
            🎲 Random
          </button>
        </div>
        <div class="lb-search-wrap">
          <span class="lb-search-icon">🔍</span>
          <input
            type="search"
            id="lb-search"
            class="lb-search"
            placeholder="Search name, message…"
            value={searchQuery}
            oninput={handleSearchInput}
            autocomplete="off"
          />
          {#if searchQuery}
            <button
              class="lb-search-clear"
              id="lb-search-clear"
              style="display: block;"
              onclick={clearSearch}
              title="Clear"
            >
              ✕
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- High-Performance Virtual Grid -->
    {#if totalItemCount === 0}
      <div class="lb-empty" id="lb-empty" style="display: block;">
        <div class="lb-empty-icon">🔍</div>
        <div class="lb-empty-text">No results found</div>
      </div>
    {:else}
      <div
        bind:this={gridRef}
        style="width: 100%; max-width: 1320px; display: block; margin: 0 auto; padding-top: {paddingTop}px; padding-bottom: {paddingBottom}px;"
      >
        <div class="lb-table-body">
          {#each visibleCards as item, index (index)}
              {@const place = item.place}
              {@const liked = likedSet.has(item.id || place)}
              {@const isExpanded = expandedMessages.has(place)}

              {#if item._skeleton}
                <div class="lb-card lb-card-skeleton" id="row-{place}">
                  <div class="lb-card-video-wrap">
                    <div
                      class="lb-card-video skeleton-shimmer"
                      style="background: var(--skeleton-bg, #e2e8f0); border-radius: 23.5px 23.5px 0 0; height: 200px;"
                    ></div>
                  </div>
                  <div class="lb-card-content" style="padding: 16px;">
                    <div class="lb-card-user">
                      <div
                        class="lb-card-avatar skeleton-shimmer"
                        style="background: var(--skeleton-bg, #e2e8f0); width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0;"
                      ></div>
                      <div class="lb-card-user-info" style="flex: 1;">
                        <div
                          class="skeleton-shimmer"
                          style="background: var(--skeleton-bg, #e2e8f0); height: 18px; width: 70%; border-radius: 8px; margin-bottom: 8px;"
                        ></div>
                        <div
                          class="skeleton-shimmer"
                          style="background: var(--skeleton-bg, #e2e8f0); height: 14px; width: 40%; border-radius: 8px;"
                        ></div>
                      </div>
                    </div>
                    <div class="lb-card-message" style="margin-top: 12px;">
                      <div
                        class="skeleton-shimmer"
                        style="background: var(--skeleton-bg, #e2e8f0); height: 14px; width: 90%; border-radius: 8px; margin-bottom: 6px;"
                      ></div>
                      <div
                        class="skeleton-shimmer"
                        style="background: var(--skeleton-bg, #e2e8f0); height: 14px; width: 60%; border-radius: 8px;"
                      ></div>
                    </div>
                    <div
                      class="lb-card-foot"
                      style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;"
                    >
                      <div
                        class="skeleton-shimmer"
                        style="background: var(--skeleton-bg, #e2e8f0); height: 32px; width: 60px; border-radius: 12px;"
                      ></div>
                      <span class="lb-card-price-chip"
                        >₹{item._formattedPrice}</span
                      >
                    </div>
                  </div>
                </div>
              {:else}
                <div
                  class="lb-card {liked ? 'liked-card liked-row' : ''}"
                  id="row-{place}"
                  onclick={() =>
                    (window.location.href = `profile.html?id=${item.id}&place=${place}`)}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) =>
                    e.key === "Enter" &&
                    (window.location.href = `profile.html?id=${item.id}&place=${place}`)}
                >
                  <div class="lb-card-video-wrap" id="video-wrap-{place}">
                    <div
                      class="lb-card-video"
                      id="card-video-{place}"
                      onclick={(e) => playVideo(e, place, item._ytId)}
                      onkeydown={(e) =>
                        e.key === "Enter" && playVideo(e, place, item._ytId)}
                      role="button"
                      tabindex="0"
                      title="Click to play YouTube Video"
                    >
                      <img
                        src={item._thumbUrl}
                        alt="YouTube Thumbnail"
                        loading="lazy"
                        width="480"
                        height="360"
                        onerror={(e) => {
                          e.currentTarget.src = item._thumbFallback;
                        }}
                      />
                    </div>
                  </div>

                  <div class="lb-card-content">
                    <div class="lb-card-user">
                      <img
                        class="lb-card-avatar"
                        src={item._avatarSrc}
                        alt={item.name}
                        loading="lazy"
                        width="200"
                        height="200"
                        onerror={(e) => {
                          const lvl = parseInt(
                            e.currentTarget.dataset.fallback || "0",
                          );
                          if (lvl === 0) {
                            e.currentTarget.dataset.fallback = "1";
                            e.currentTarget.src = item._avatarFallback1;
                          } else {
                            e.currentTarget.dataset.fallback = "2";
                            e.currentTarget.src = item._avatarFallback2;
                          }
                        }}
                      />
                      <div class="lb-card-user-info">
                        <div class="lb-card-user-top">
                          <div class="lb-card-name">
                            {item.name}
                          </div>
                          <span class="lb-card-place-pill">#{place}</span>
                        </div>
                        <div class="lb-card-social-links">
                          {#if item.youtubeUrl}
                            <a
                              href={item.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="lb-social-icon lb-social-yt"
                              onclick={(e) => e.stopPropagation()}
                              title="YouTube"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                fill="currentColor"
                                ><path
                                  d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
                                /></svg
                              >
                            </a>
                          {/if}
                          {#if item.instagramUrl}
                            <a
                              href={item.instagramUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="lb-social-icon lb-social-ig"
                              onclick={(e) => e.stopPropagation()}
                              title="Instagram"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                fill="currentColor"
                                ><path
                                  d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"
                                /></svg
                              >
                            </a>
                          {/if}
                        </div>
                      </div>
                    </div>

                    <div class="lb-card-message">
                      {#if item._isShortMsg && !isExpanded}
                        <div
                          class="lb-card-message-text"
                          style="display: block; -webkit-line-clamp: unset; max-height: none;"
                        >
                          "{item._rawMsg}"
                        </div>
                      {:else if item._isShortMsg && isExpanded}
                        <div class="lb-card-message-text expanded">
                          "{item._rawMsg}"
                        </div>
                      {:else}
                        <div
                          class="lb-card-message-text {isExpanded
                            ? 'expanded'
                            : ''}"
                        >
                          "{item._rawMsg}"
                        </div>
                        <button
                          class="lb-message-more-btn"
                          onclick={(e) => {
                            e.stopPropagation();
                            toggleMsgExpand(item, !isExpanded);
                          }}
                        >
                          {isExpanded ? "less" : "more"}
                        </button>
                      {/if}
                    </div>

                    <div class="lb-card-foot">
                      <button
                        class="lb-card-like-btn {liked ? 'liked' : ''}"
                        id="like-btn-{place}"
                        onclick={(e) => {
                          e.stopPropagation();
                          toggleLikeItem(place, e.currentTarget);
                        }}
                        aria-label="Like {item.name}"
                      >
                        <span class="like-heart">{liked ? "❤️" : "🤍"}</span>
                        <span class="lb-like-count" id="like-count-{place}">
                          {formatLikes(item.likes || 0)}
                        </span>
                      </button>
                      <span class="lb-card-price-chip">
                        ₹{item._formattedPrice}
                      </span>
                    </div>
                  </div>
                </div>
              {/if}
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <!-- FOOTER -->
  <footer class="site-footer">
    <div class="footer-logo">⚡ &nbsp; web100k.com &nbsp; ⚡</div>
    <p class="footer-copy">
      100,000 exclusive digital places. Once claimed, yours forever.
    </p>
    <p class="footer-legal">
      © 2026 web100k.com · All Rights Reserved · The Permanent Digital Grid
    </p>
  </footer>
</div>

<!-- GLOBAL MINI PLAYER MUST BE OUTSIDE OF ANY TRANSFORMED CONTAINERS -->
<!-- GLOBAL MINI PLAYER -->
<div
  id="lb-global-mini-player"
  class=""
  style="opacity: 0; pointer-events: none;"
>
  <div class="lbmp-bar">
    <span class="lbmp-title" id="lbmp-title">▶ Playing Video</span>
    <div class="lbmp-bar-actions">
      <button
        class="lbmp-expand-btn"
        id="lbmp-expand-btn"
        onclick={scrollToActiveCard}
        title="Go to video">⤢</button
      >
      <button
        class="lbmp-close-btn"
        id="lbmp-close-btn"
        onclick={closePlayer}
        title="Close player">✕</button
      >
    </div>
  </div>
  <div class="lbmp-screen" id="lbmp-screen"></div>
</div>

<!-- BUY MODAL IS NOW BYPASSED, REDIRECT HAPPENS DIRECTLY -->
