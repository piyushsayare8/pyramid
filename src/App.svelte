<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  // ─── Supabase Client ────────────────────────────────────────────────
  const SUPABASE_URL = "https://conecotzzmloenikxefo.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvbmVjb3R6em1sb2VuaWt4ZWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTg5NzksImV4cCI6MjA5ODI3NDk3OX0.M5llBovp2kS6s83ZOIxETYKoRl6dFcF-96Fkc53XHQM";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ─── CDN Base URL ───────────────────────────────────────────────────
  const CDN_BASE = "https://data.creatorspyramid.com";

  // ─── Constants ───────────────────────────────────────────────────────
  export const TOTAL_PLACES = 100000;


  const YT_REGEX = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
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
  function getPriceForPlace(place) {
    return +(1 + (place - 1) * 0.03).toFixed(2);
  }

  function getPlaceForPrice(price) {
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
    const profilePicture = raw.profile_image_upload || raw.profilePicture || "";
    const likes = raw.total_like_count ?? raw.likes ?? 0;
    const ytId = getYoutubeVidId(youtubeUrl);
    const price = getPriceForPlace(place);
    const encodedName = encodeURIComponent(name);

    // Image fallback chain: profile_image_upload -> CDN /image/{id}.jpg -> ui-avatars
    const cdnImageFallback = `${CDN_BASE}/image/${id}.jpg`;
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
      _msgPreview: message.length > 85 ? message.slice(0, 85).trim() + "..." : null,
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

  // Core data: Map<placeNumber, enrichedItem> for O(1) lookups
  let itemsMap = $state(new Map());
  let itemsVersion = $state(0); // bump on any mutation

  // Sort UI state — "newest" = price.json, "top_liked" = like.json
  let currentSort = $state("newest");
  // Search UI state — kept for future server integration (no local filtering)
  let searchQuery = $state("");
  let likedSet = $state(new Set());
  // Tracks IDs whose like has been sent to Supabase (permanent, never toggle)
  let sentLikesSet = $state(new Set());
  let expandedMessages = $state(new Set());
  let theme = $state("light");
  let buyModalOpen = $state(false);
  let activeVideoPlace = $state(null);
  let activeVideoId = $state(null);

  let paymentData = $state({
    paymentLink: "https://rzp.io/l/web100k_payment",
    amount: 99
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
  let columns = $state(3);
  let gridTopOffset = $state(0);
  let gridRef = $state(null);
  let rafId = null;
  let isOnCard = false;

  // Scroll RAF batching
  let _scrollRafPending = false;

  // Persistence debounce
  let _persistTimer = null;

  // ─── Helper: set items from array ────────────────────────────────────
  function setItemsFromArray(arr) {
    // Clear + re-populate in-place to preserve the $state reactive proxy
    itemsMap.clear();
    for (let i = 0; i < arr.length; i++) {
      const item = enrichItem(arr[i]);
      itemsMap.set(item.place, item);
    }
    itemsVersion++;
  }

  // ─── Items list — display in server/insertion order (no local sort) ──
  let itemsList = $derived.by(() => {
    void itemsVersion; // track mutations
    return Array.from(itemsMap.values());
  });

  // Chunk items into rows
  let rows = $derived.by(() => {
    const cols = columns;
    const data = itemsList;
    const len = data.length;
    const result = new Array(Math.ceil(len / cols));
    for (let i = 0, r = 0; i < len; i += cols, r++) {
      result[r] = data.slice(i, i + cols);
    }
    return result;
  });

  // ─── Virtual Scroll Engine ──────────────────────────────────────────
  let ROW_HEIGHT = $derived(columns === 1 ? 540 : 480);
  const OVERSCAN = 3;
  let totalGridHeight = $derived(rows.length * ROW_HEIGHT);
  let relativeScrollTop = $derived(Math.max(0, scrollTop - gridTopOffset));

  let startRowIndex = $derived(
    Math.max(0, Math.floor(relativeScrollTop / ROW_HEIGHT) - OVERSCAN),
  );
  let endRowIndex = $derived(
    Math.min(
      rows.length,
      Math.ceil((relativeScrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
    ),
  );
  let visibleRows = $derived(rows.slice(startRowIndex, endRowIndex));
  let gridOffsetY = $derived(startRowIndex * ROW_HEIGHT);

  // ─── Computed gap string (avoid template interpolation) ─────────────
  let gridGap = $derived(columns === 1 ? "20px" : columns === 2 ? "22px" : "28px");

  // ─── RAF-batched scroll handler ─────────────────────────────────────
  function handleScroll() {
    if (_scrollRafPending) return;
    _scrollRafPending = true;
    requestAnimationFrame(() => {
      scrollTop = window.scrollY || document.documentElement.scrollTop;
      _scrollRafPending = false;
    });
  }

  // ─── Debounced resize handler ───────────────────────────────────────
  const handleResize = debounce(() => {
    viewportHeight = window.innerHeight;
    const w = window.innerWidth;
    if (w <= 640) columns = 1;
    else if (w <= 1024) columns = 2;
    else columns = 3;
    if (gridRef) gridTopOffset = gridRef.offsetTop;
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
    loadLeaderboard(); // Refetch when sort changes
  }

  // ─── Fetch individual user data from CDN ────────────────────────────
  async function fetchUserData(id) {
    try {
      const res = await fetch(`${CDN_BASE}/users/${id}.json`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error(`Error fetching user ${id}:`, err);
      return null;
    }
  }

  // ─── Debounced persistence ──────────────────────────────────────────
  function schedulePersist() {
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      try {
        const arr = Array.from(itemsMap.values());
        localStorage.setItem("top15000_data_v1", JSON.stringify(arr));
        localStorage.setItem("top15000_liked", JSON.stringify([...likedSet]));
        localStorage.setItem("top15000_sent_likes", JSON.stringify([...sentLikesSet]));
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
      itemsVersion++;
    } else {
      // Like — increment UI count
      likedSet.add(idToLike);
      const updatedItem = {
        ...item,
        likes: (item.likes || 0) + 1,
      };
      itemsMap.set(placeNum, updatedItem);
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
            if (error) console.error("Error sending like to Supabase:", error.message);
          })
          .catch((err) => console.error("Error sending like to Supabase:", err));
      }
    }

    // Debounced persistence
    schedulePersist();
  }

  // ─── Message expand/collapse ────────────────────────────────────────
  function toggleMsgExpand(placeNum, expand) {
    // Mutate in-place — Svelte 5 $state proxy tracks .add/.delete
    if (expand) {
      expandedMessages.add(placeNum);
    } else {
      expandedMessages.delete(placeNum);
    }
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

  function tick() {
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
    rafId = requestAnimationFrame(tick);
  }

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
    rafId = requestAnimationFrame(tick);
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
  let soldCount = $derived(itemsMap.size);
  let remainingCount = $derived(TOTAL_PLACES - soldCount);
  let progressPct = $derived(Math.max((soldCount / TOTAL_PLACES) * 100, 0.2));

  let displayPrice = $derived(paymentData.amount !== null ? paymentData.amount : getPriceForPlace(itemsMap.size + 1));
  let nextPlace = $derived(getPlaceForPrice(displayPrice));
  let displayPriceFormatted = $derived(formatPrice(displayPrice));
  let nextAfterPlace = $derived(nextPlace + 1);
  let nextAfterPrice = $derived(formatPrice(getPriceForPlace(nextAfterPlace)));
  let isSoldOut = $derived(nextPlace > TOTAL_PLACES);

  // Pre-formatted values for buy section (avoid repeated toLocaleString)
  let nextPlaceFormatted = $derived(nextPlace.toLocaleString("en-IN"));
  let nextAfterPlaceFormatted = $derived(nextAfterPlace.toLocaleString("en-IN"));

  // ─── Buy form submit ───────────────────────────────────────────────
  function handleBuySubmit(e) {
    if (e) e.preventDefault();

    if (paymentData.paymentLink) {
      window.location.href = paymentData.paymentLink;
      return;
    }
    
    showToast("Payment link is not available right now. Please try again later.");
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────
  let pollInterval;
  let leaderboardPollInterval;

  async function loadPaymentData() {
    try {
      const response = await fetch("https://data.creatorspyramid.com/active-link.json");
      if (response.ok) {
        const data = await response.json();
        const link = data.paymentLink || data.payment_link || "";
        const amt = data.amount !== undefined ? data.amount : (data.price !== undefined ? data.price : null);
        if (paymentData.paymentLink !== link || paymentData.amount !== amt) {
          paymentData.paymentLink = link;
          paymentData.amount = amt;
        }
      }
    } catch (err) {
      console.error("Error loading payment data from active-link.json:", err);
    }
  }

  async function loadLeaderboard() {
    try {
      // Phase 1: Fetch the ID index from CDN
      const indexFile = currentSort === "top_liked" ? "like.json" : "price.json";
      const indexUrl = `${CDN_BASE}/${indexFile}`;
      const response = await fetch(indexUrl);
      if (!response.ok) {
        console.error(`Failed to fetch ${indexFile}: ${response.status}`);
        return;
      }
      const ids = await response.json(); // e.g. [6, 5, 3, 1]

      // Phase 2: Fetch each user's data in parallel
      const userPromises = ids.map((id) => fetchUserData(id));
      const users = await Promise.all(userPromises);

      // Build the items array preserving the order from the index
      const arr = [];
      for (let i = 0; i < ids.length; i++) {
        const userData = users[i];
        if (!userData) continue; // Skip failed fetches

        const id = userData.id ?? ids[i];
        const place = i + 1; // Position in the sorted list
        arr.push({
          ...userData,
          id,
          place,
        });
      }

      setItemsFromArray(arr);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
    }
  }

  onMount(() => {
    loadPaymentData();
    loadLeaderboard();
    pollInterval = setInterval(loadPaymentData, 3000);
    leaderboardPollInterval = setInterval(loadLeaderboard, 60000);

    // Restore liked set — populate in-place to preserve $state proxy
    try {
      const savedLiked = JSON.parse(localStorage.getItem("top15000_liked") || "[]");
      likedSet.clear();
      for (const id of savedLiked) likedSet.add(id);
    } catch {}

    // Restore sent likes set (permanent record of Supabase-sent likes)
    try {
      const savedSent = JSON.parse(localStorage.getItem("top15000_sent_likes") || "[]");
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
      const colors = ["#7c3aed", "#e91e8c", "#0d9488", "#f59e0b", "#2563eb", "#dc2626", "#16a34a", "#9333ea"];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      bgEl.style.background = `radial-gradient(circle at 50% 50%, #ffffff 0%, ${randomColor} 70%)`;
    }

    // Ambient background
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

    // Animate remaining places counter smoothly
    const diff = remainingCount - displayRemaining;
    if (diff !== 0) {
      const start = displayRemaining;
      const duration = 800;
      const startTime = performance.now();
      function step(now) {
        const p = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        displayRemaining = Math.round(start + diff * eased);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
    clearTimeout(_persistTimer);
    if (_videoObserver) _videoObserver.disconnect();
    clearInterval(pollInterval);
    clearInterval(leaderboardPollInterval);
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
            Place #<span id="current-place-number"
              >{nextPlaceFormatted}</span
            >
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
            >Place #<span id="buy-place-desc"
              >{nextPlaceFormatted}</span
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
              Claim Place #<span id="buy-btn-place"
                >{nextPlaceFormatted}</span
              >
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
    {#if itemsList.length === 0}
      <div class="lb-empty" id="lb-empty" style="display: block;">
        <div class="lb-empty-icon">🔍</div>
        <div class="lb-empty-text">No results found</div>
      </div>
    {:else}
      <div
        bind:this={gridRef}
        class="lb-table-body"
        style="position: relative; width: 100%; height: {totalGridHeight}px; display: block; margin: 0 auto;"
      >
        {#each visibleRows as rowItems, rowIndex (startRowIndex + rowIndex)}
          <div
            style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({gridOffsetY + rowIndex * ROW_HEIGHT}px); display: grid; grid-template-columns: repeat({columns}, minmax(0, 1fr)); gap: {gridGap}; padding-bottom: 28px;"
          >
            {#each rowItems as item (item.id)}
              {@const place = item.place}
              {@const liked = likedSet.has(item.id || place)}
              {@const isExpanded = expandedMessages.has(place)}

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
                        const lvl = parseInt(e.currentTarget.dataset.fallback || "0");
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
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
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
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                          </a>
                        {/if}
                      </div>
                      <a
                        href="profile.html?id={item.id}&place={place}"
                        class="lb-card-visit"
                        onclick={(e) => e.stopPropagation()}
                      >
                        Visit Profile ↗
                      </a>
                    </div>
                  </div>

                  <div class="lb-card-message">
                    {#if item._isShortMsg}
                      "{item._rawMsg}"
                    {:else if !isExpanded}
                      <span class="msg-short" id="msg-short-{place}">
                        "{item._msgPreview}{" "}
                        <button
                          class="lb-msg-more"
                          onclick={(e) => {
                            e.stopPropagation();
                            toggleMsgExpand(place, true);
                          }}
                        >
                          more
                        </button>
                        "
                      </span>
                    {:else}
                      <span class="msg-full" id="msg-full-{place}">
                        "{item._rawMsg}{" "}
                        <button
                          class="lb-msg-less"
                          onclick={(e) => {
                            e.stopPropagation();
                            toggleMsgExpand(place, false);
                          }}
                        >
                          less
                        </button>
                        "
                      </span>
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
            {/each}
          </div>
        {/each}
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
