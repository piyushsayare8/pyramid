<script>
  import { onMount, onDestroy } from "svelte";

  // ─── Constants ───────────────────────────────────────────────────────
  export const TOTAL_PLACES = 100000;

  const SAMPLE_BUYERS = [
    { place: 1, name: "Arjun Mehta", profilePicture: "https://ui-avatars.com/api/?name=Arjun+Mehta&background=7c3aed&color=fff&size=200", youtubeUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk", message: "First is first. No one can take this from me. History is written by those who act first! 🚀", likes: 142 },
    { place: 2, name: "Priya Sharma", profilePicture: "https://ui-avatars.com/api/?name=Priya+Sharma&background=e91e8c&color=fff&size=200", youtubeUrl: "https://www.youtube.com/watch?v=5qap5aO4i9A", message: "Dreamer, builder, believer. Proud to hold Place #2 on the most exclusive internet list ever made.", likes: 98 },
    { place: 3, name: "Rohan Das", profilePicture: "https://ui-avatars.com/api/?name=Rohan+Das&background=0d9488&color=fff&size=200", youtubeUrl: "https://www.youtube.com/watch?v=DWcJFNfaw9c", message: "Top 3 baby! Invested ₹3 and got a piece of internet history. Future generations will know this name. 🔥", likes: 77 },
    { place: 4, name: "Sneha Patel", profilePicture: "https://ui-avatars.com/api/?name=Sneha+Patel&background=f59e0b&color=fff&size=200", youtubeUrl: "https://www.youtube.com/watch?v=lTRiuFIWV54", message: "Small price, big legacy. Every great journey begins with a single step — or in this case, ₹4.", likes: 61 },
    { place: 5, name: "Vikram Nair", profilePicture: "https://ui-avatars.com/api/?name=Vikram+Nair&background=2563eb&color=fff&size=200", youtubeUrl: "https://www.youtube.com/watch?v=7NOSDKb0HlU", message: "Place #5! I'm part of the elite Top 10 forever. No amount of money can change history. 🌟", likes: 54 },
    { place: 6, name: "Kavya Reddy", profilePicture: "https://ui-avatars.com/api/?name=Kavya+Reddy&background=dc2626&color=fff&size=200", youtubeUrl: "https://www.youtube.com/watch?v=M5QY2_8704o", message: "Six is my lucky number and this is my lucky place. Seize every opportunity that comes your way!", likes: 43 },
    { place: 7, name: "Amit Kumar", profilePicture: "https://ui-avatars.com/api/?name=Amit+Kumar&background=16a34a&color=fff&size=200", youtubeUrl: "https://www.youtube.com/watch?v=-FlxM_0S2lA", message: "Lucky number 7. When I saw this site I knew I had to grab a spot. Best ₹7 I ever spent. Seriously.", likes: 39 },
    { place: 8, name: "Divya Singh", profilePicture: "https://ui-avatars.com/api/?name=Divya+Singh&background=9333ea&color=fff&size=200", youtubeUrl: "https://www.youtube.com/watch?v=8Xg7E9shq0c", message: "Eternal optimist. Permanent dreamer. Place #8 on the internet — forever. This is my digital legacy. ✨", likes: 35 },
    { place: 9, name: "Rajan Iyer", profilePicture: "https://ui-avatars.com/api/?name=Rajan+Iyer&background=ea580c&color=fff&size=200", youtubeUrl: "https://www.youtube.com/watch?v=n61ULEU7CO0", message: "Nine lives, one permanent digital spot. The internet never forgets, and I am now part of it forever.", likes: 28 },
    { place: 10, name: "Meena Gupta", profilePicture: "https://ui-avatars.com/api/?name=Meena+Gupta&background=0891b2&color=fff&size=200", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", message: "Double digits! Proud to be in the Top 10. In a world of 8 billion people, only 10 got here first. 💎", likes: 22 },
  ];

  // ─── Pure utility functions (zero allocation hot-paths) ──────────────
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
    return +(place * 0.05).toFixed(2);
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
    const name = raw.name || "Anonymous";
    const ytId = getYoutubeVidId(raw.youtubeUrl);
    const price = getPriceForPlace(place);
    const encodedName = encodeURIComponent(name);
    return {
      ...raw,
      id: raw.id || place,
      place,
      name,
      _ytId: ytId,
      _thumbUrl: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
      _thumbFallback: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      _avatarSrc: raw.profilePicture || `https://ui-avatars.com/api/?name=${encodedName}&background=7c3aed&color=fff&size=200`,
      _avatarFallback: `https://ui-avatars.com/api/?name=${encodedName}&background=333&color=fff&size=200`,
      _price: price,
      _formattedPrice: formatPrice(price),
      _placeFormatted: place.toLocaleString("en-IN"),
      _rawMsg: raw.message || "—",
      _isShortMsg: (raw.message || "—").length <= 85,
      _msgPreview: (raw.message || "—").length > 85 ? (raw.message || "—").slice(0, 85).trim() + "..." : null,
      _searchText: `${name.toLowerCase()} ${(raw.message || "").toLowerCase()} ${place}`,
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
  // Sorted array cache — only rebuilt when sort key or items change
  let _sortedArray = $state([]);
  let _lastSortKey = $state("");
  let _lastItemsVersion = $state(0);
  let itemsVersion = $state(0); // bump on any mutation

  let currentSort = $state("price");
  let searchQuery = $state("");
  let _debouncedQuery = $state(""); // actual filter trigger (debounced)
  let likedSet = $state(new Set());
  let expandedMessages = $state(new Set());
  let theme = $state("light");
  let buyModalOpen = $state(false);
  let activeVideoPlace = $state(null);
  let activeVideoId = $state(null);

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
    const map = new Map();
    for (let i = 0; i < arr.length; i++) {
      const item = enrichItem(arr[i]);
      map.set(item.place, item);
    }
    itemsMap = map;
    itemsVersion++;
  }

  // Initialize with sample data
  setItemsFromArray(SAMPLE_BUYERS);

  // ─── Sorted array cache — O(n log n) only on sort key change ────────
  let sortedItems = $derived.by(() => {
    const ver = itemsVersion;
    const sort = currentSort;

    // Rebuild sorted array only when items changed or sort key changed
    const arr = Array.from(itemsMap.values());

    if (sort === "price") {
      arr.sort((a, b) => b.place - a.place);
    } else if (sort === "likes") {
      arr.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else if (sort === "random") {
      arr.sort((a, b) => ((a.id * 13) % 7) - ((b.id * 13) % 7));
    }

    return arr;
  });

  // ─── Debounced search — filter only on debounced query ──────────────
  let filteredData = $derived.by(() => {
    const q = _debouncedQuery;
    if (!q) return sortedItems;
    return sortedItems.filter((item) => item._searchText.includes(q));
  });

  // Chunk items into rows — only when filteredData changes
  let rows = $derived.by(() => {
    const cols = columns;
    const data = filteredData;
    const len = data.length;
    const result = new Array(Math.ceil(len / cols));
    for (let i = 0, r = 0; i < len; i += cols, r++) {
      result[r] = data.slice(i, i + cols);
    }
    return result;
  });

  // ─── Virtual Scroll Engine ──────────────────────────────────────────
  const ROW_HEIGHT = 480;
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

  // ─── Debounced search input ─────────────────────────────────────────
  const _applySearchDebounced = debounce((val) => {
    _debouncedQuery = val;
  }, 200);

  function handleSearchInput(e) {
    const val = e.currentTarget.value;
    searchQuery = val; // instant UI feedback (input value)
    _applySearchDebounced(val.trim().toLowerCase());
  }

  function clearSearch() {
    searchQuery = "";
    _debouncedQuery = "";
  }

  // ─── Theme toggle ──────────────────────────────────────────────────
  function toggleThemeMode() {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("top15000_theme", theme);
  }

  function setSortOption(sortBy) {
    currentSort = sortBy;
  }

  // ─── Debounced persistence ──────────────────────────────────────────
  function schedulePersist() {
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      try {
        const arr = Array.from(itemsMap.values());
        localStorage.setItem("top15000_data_v1", JSON.stringify(arr));
        localStorage.setItem("top15000_liked", JSON.stringify([...likedSet]));
      } catch {}
    }, 1000);
  }

  // ─── Like toggle — O(1) Map mutation, no array cloning ─────────────
  function toggleLikeItem(placeNum, btnElement) {
    const isLiked = likedSet.has(placeNum);

    // Mutate liked set in-place
    if (isLiked) {
      likedSet.delete(placeNum);
    } else {
      likedSet.add(placeNum);
    }
    // Trigger reactivity by reassigning
    likedSet = new Set(likedSet);

    // O(1) item lookup + targeted mutation
    const item = itemsMap.get(placeNum);
    if (item) {
      const updatedItem = {
        ...item,
        likes: Math.max(0, (item.likes || 0) + (isLiked ? -1 : 1)),
      };
      itemsMap.set(placeNum, updatedItem);
      itemsMap = new Map(itemsMap); // trigger reactivity
      itemsVersion++;
    }

    // Debounced persistence — no blocking the main thread
    schedulePersist();

    if (btnElement && !isLiked) {
      throwHearts(btnElement);
    }
  }

  // ─── Message expand/collapse ────────────────────────────────────────
  function toggleMsgExpand(placeNum, expand) {
    if (expand) {
      expandedMessages.add(placeNum);
    } else {
      expandedMessages.delete(placeNum);
    }
    expandedMessages = new Set(expandedMessages);
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

  let nextPlace = $derived(itemsMap.size + 1);
  let currentPrice = $derived(getPriceForPlace(nextPlace));
  let formattedPrice = $derived(formatPrice(currentPrice));
  let nextAfterPlace = $derived(nextPlace + 1);
  let nextAfterPrice = $derived(formatPrice(getPriceForPlace(nextAfterPlace)));
  let isSoldOut = $derived(nextPlace > TOTAL_PLACES);
  let charRemaining = $derived(300 - formMsg.length);

  // Pre-formatted values for buy section (avoid repeated toLocaleString)
  let nextPlaceFormatted = $derived(nextPlace.toLocaleString("en-IN"));
  let nextAfterPlaceFormatted = $derived(nextAfterPlace.toLocaleString("en-IN"));

  // ─── Buy form submit ───────────────────────────────────────────────
  function handleBuySubmit(e) {
    e.preventDefault();
    if (!formName.trim()) {
      showToast("Please enter your name");
      return;
    }
    const place = nextPlace;
    if (place > TOTAL_PLACES) {
      showToast("All places are sold out!");
      return;
    }

    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(formName.trim())}&background=7c3aed&color=fff&size=200`;
    const entry = {
      id: place,
      place: place,
      name: formName.trim(),
      profilePicture: formProfile.trim() || fallback,
      youtubeUrl: formYoutube.trim() || "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      message: formMsg.trim() || "I claimed my permanent place on the internet!",
      likes: 0,
    };

    const enriched = enrichItem(entry);
    itemsMap.set(place, enriched);
    itemsMap = new Map(itemsMap);
    itemsVersion++;

    // Debounced persist
    schedulePersist();

    formName = "";
    formProfile = "";
    formYoutube = "";
    formMsg = "";
    buyModalOpen = false;
    showToast(`🎉 Congrats! You now own Place #${place} forever!`);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────
  onMount(() => {
    // Restore liked set
    try {
      const savedLiked = JSON.parse(localStorage.getItem("top15000_liked") || "[]");
      likedSet = new Set(savedLiked);
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

    // Restore saved items
    try {
      const stored = localStorage.getItem("top15000_data_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        const arr = parsed.map((item, idx) => ({
          ...item,
          id: item.id || item.place || idx + 1,
          place: item.place || idx + 1,
        }));
        setItemsFromArray(arr);
      }
    } catch {}

    // Initial sizing
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
            >{formattedPrice}</span
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
          onclick={() => !isSoldOut && (buyModalOpen = true)}
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
              for ₹<span id="buy-btn-price">{formattedPrice}</span>
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
            class="lb-sort-btn {currentSort === 'price' ? 'active' : ''}"
            onclick={() => setSortOption("price")}
          >
            💰 Price
          </button>
          <button
            class="lb-sort-btn {currentSort === 'likes' ? 'active' : ''}"
            onclick={() => setSortOption("likes")}
          >
            ❤️ Likes
          </button>
          <button
            class="lb-sort-btn {currentSort === 'random' ? 'active' : ''}"
            onclick={() => setSortOption("random")}
          >
            🔀 Random
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
    {#if filteredData.length === 0}
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
                  (window.location.href = `profile.html?place=${place}`)}
                role="button"
                tabindex="0"
                onkeydown={(e) =>
                  e.key === "Enter" &&
                  (window.location.href = `profile.html?place=${place}`)}
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
                        e.currentTarget.src = item._avatarFallback;
                      }}
                    />
                    <div class="lb-card-user-info">
                      <div class="lb-card-user-top">
                        <div class="lb-card-name">
                          {item.name}
                        </div>
                        <span class="lb-card-place-pill">#{place}</span>
                      </div>
                      <a
                        href="profile.html?place={place}"
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

  <!-- GLOBAL MINI PLAYER -->
  <div
    id="lb-global-mini-player"
    class="lbmp-floating"
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

  <!-- BUY MODAL -->
  <div
    id="buy-modal"
    class="modal-overlay {buyModalOpen ? 'show' : ''}"
    onclick={(e) => {
      if (e.target === e.currentTarget) buyModalOpen = false;
    }}
    role="presentation"
  >
    <div
      class="modal-box"
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div class="modal-glow"></div>
      <button class="modal-close-btn" onclick={() => (buyModalOpen = false)}
        >✕</button
      >
      <div class="modal-header">
        <div class="modal-place-badge">
          Place #{nextPlaceFormatted} — Permanent Grid
        </div>
        <h2 class="modal-title">Claim Your Permanent Place</h2>
      </div>
      <form id="buy-form" onsubmit={handleBuySubmit}>
        <div class="form-row">
          <div class="form-group">
            <label for="form-name">Your Name *</label>
            <input
              type="text"
              id="form-name"
              placeholder="Enter your name"
              required
              maxlength="80"
              bind:value={formName}
            />
          </div>
          <div class="form-group">
            <label for="form-profile">Profile Picture URL</label>
            <input
              type="url"
              id="form-profile"
              placeholder="https://example.com/photo.jpg"
              bind:value={formProfile}
            />
          </div>
        </div>
        <div class="form-group">
          <label for="form-youtube">
            YouTube Video / Reel URL <span class="form-label-hint"
              >(Optional)</span
            >
          </label>
          <input
            type="url"
            id="form-youtube"
            placeholder="https://www.youtube.com/watch?v=... or Reel link"
            bind:value={formYoutube}
          />
        </div>
        <div class="form-group">
          <label for="form-message">
            Your Message <span class="form-label-hint">(up to 300 chars)</span>
          </label>
          <textarea
            id="form-message"
            placeholder="Write something memorable — it stays here forever…"
            maxlength="300"
            rows="3"
            bind:value={formMsg}
          ></textarea>
          <div
            class="form-char-count"
            style="color: {charRemaining < 30
              ? '#ef4444'
              : charRemaining < 80
                ? '#f5c842'
                : ''};"
          >
            <span id="form-char-remaining">{charRemaining}</span> characters remaining
          </div>
        </div>
        <div class="form-price-summary">
          <div class="fps-label">Total to pay</div>
          <div class="fps-price">
            ₹<span id="fps-amount">{currentPrice}</span>
          </div>
          <div class="fps-note">
            for Place #{nextPlaceFormatted} · permanently yours
          </div>
        </div>
        <div class="form-actions">
          <button
            type="button"
            class="form-btn-cancel"
            onclick={() => (buyModalOpen = false)}>Cancel</button
          >
          <button type="submit" class="form-btn-pay" id="form-btn-pay">
            <span
              >Pay ₹<span id="form-pay-amount">{currentPrice}</span> &amp; Claim</span
            >
            <span class="pay-arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
