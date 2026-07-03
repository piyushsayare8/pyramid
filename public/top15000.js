// ==========================================
// TOP15000.COM — JAVASCRIPT v1.0
// ==========================================

// ── Constants ─────────────────────────────
const TOTAL_PLACES = 100000;
const ROWS_PER_PAGE = 30;

function getPriceForPlace(place) {
  return +(place * 0.05).toFixed(2);
}

function formatPrice(price) {
  if (Number.isInteger(price)) return price.toLocaleString('en-IN');
  const parts = price.toFixed(2).split('.');
  parts[0] = Number(parts[0]).toLocaleString('en-IN');
  return parts.join('.');
}

// ── Sample data (first 10 buyers) ─────────
// Place number = price (₹). Strict order.
const SAMPLE_BUYERS = [
  {
    place: 1, name: 'Arjun Mehta',
    profilePicture: 'https://ui-avatars.com/api/?name=Arjun+Mehta&background=7c3aed&color=fff&size=200',
    youtubeUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    message: 'First is first. No one can take this from me. History is written by those who act first! 🚀',
    likes: 142
  },
  {
    place: 2, name: 'Priya Sharma',
    profilePicture: 'https://ui-avatars.com/api/?name=Priya+Sharma&background=e91e8c&color=fff&size=200',
    youtubeUrl: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
    message: 'Dreamer, builder, believer. Proud to hold Place #2 on the most exclusive internet list ever made.',
    likes: 98
  },
  {
    place: 3, name: 'Rohan Das',
    profilePicture: 'https://ui-avatars.com/api/?name=Rohan+Das&background=0d9488&color=fff&size=200',
    youtubeUrl: 'https://www.youtube.com/watch?v=DWcJFNfaw9c',
    message: 'Top 3 baby! Invested ₹3 and got a piece of internet history. Future generations will know this name. 🔥',
    likes: 77
  },
  {
    place: 4, name: 'Sneha Patel',
    profilePicture: 'https://ui-avatars.com/api/?name=Sneha+Patel&background=f59e0b&color=fff&size=200',
    youtubeUrl: 'https://www.youtube.com/watch?v=lTRiuFIWV54',
    message: 'Small price, big legacy. Every great journey begins with a single step — or in this case, ₹4.',
    likes: 61
  },
  {
    place: 5, name: 'Vikram Nair',
    profilePicture: 'https://ui-avatars.com/api/?name=Vikram+Nair&background=2563eb&color=fff&size=200',
    youtubeUrl: 'https://www.youtube.com/watch?v=7NOSDKb0HlU',
    message: 'Place #5! I\'m part of the elite Top 10 forever. No amount of money can change history. 🌟',
    likes: 54
  },
  {
    place: 6, name: 'Kavya Reddy',
    profilePicture: 'https://ui-avatars.com/api/?name=Kavya+Reddy&background=dc2626&color=fff&size=200',
    youtubeUrl: 'https://www.youtube.com/watch?v=M5QY2_8704o',
    message: 'Six is my lucky number and this is my lucky place. Seize every opportunity that comes your way!',
    likes: 43
  },
  {
    place: 7, name: 'Amit Kumar',
    profilePicture: 'https://ui-avatars.com/api/?name=Amit+Kumar&background=16a34a&color=fff&size=200',
    youtubeUrl: 'https://www.youtube.com/watch?v=-FlxM_0S2lA',
    message: 'Lucky number 7. When I saw this site I knew I had to grab a spot. Best ₹7 I ever spent. Seriously.',
    likes: 39
  },
  {
    place: 8, name: 'Divya Singh',
    profilePicture: 'https://ui-avatars.com/api/?name=Divya+Singh&background=9333ea&color=fff&size=200',
    youtubeUrl: 'https://www.youtube.com/watch?v=8Xg7E9shq0c',
    message: 'Eternal optimist. Permanent dreamer. Place #8 on the internet — forever. This is my digital legacy. ✨',
    likes: 35
  },
  {
    place: 9, name: 'Rajan Iyer',
    profilePicture: 'https://ui-avatars.com/api/?name=Rajan+Iyer&background=ea580c&color=fff&size=200',
    youtubeUrl: 'https://www.youtube.com/watch?v=n61ULEU7CO0',
    message: 'Nine lives, one permanent digital spot. The internet never forgets, and I am now part of it forever.',
    likes: 28
  },
  {
    place: 10, name: 'Meena Gupta',
    profilePicture: 'https://ui-avatars.com/api/?name=Meena+Gupta&background=0891b2&color=fff&size=200',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    message: 'Double digits! Proud to be in the Top 10. In a world of 8 billion people, only 10 got here first. 💎',
    likes: 22
  }
];

// ── State ─────────────────────────────────
let leaderboardData = [];
let currentSort = 'price';
let searchQuery = '';
let displayedCount = 0;
let filteredData = [];

// ── Init ──────────────────────────────────
function init() {
  loadData();
  updateCounterUI();
  updateBuyUI();
  renderLeaderboard();
  setupCharCounter();
  applyDynamicBackground();
}

// ── Data ──────────────────────────────────
function loadData() {
  try {
    const stored = localStorage.getItem('top15000_data_v1');
    if (stored) {
      leaderboardData = JSON.parse(stored).map((item, idx) => ({
        ...item,
        youtubeUrl: item.youtubeUrl || (SAMPLE_BUYERS[idx] ? SAMPLE_BUYERS[idx].youtubeUrl : 'https://www.youtube.com/watch?v=jfKfPfyJRdk')
      }));
    } else {
      leaderboardData = SAMPLE_BUYERS.map(b => ({ ...b, id: b.place }));
      saveData();
    }
  } catch (e) {
    leaderboardData = SAMPLE_BUYERS.map(b => ({ ...b, id: b.place }));
  }
}

function saveData() {
  try {
    localStorage.setItem('top15000_data_v1', JSON.stringify(leaderboardData));
  } catch (e) { }
}

// ── Computed values ────────────────────────
function getSoldCount() {
  return leaderboardData.length;
}

function getNextPlace() {
  return getSoldCount() + 1;
}

// ── Counter UI ────────────────────────────
function updateCounterUI() {
  const sold = getSoldCount();
  const remaining = TOTAL_PLACES - sold;

  // Animate number
  animateCounter('places-remaining', remaining);

  // Progress bar
  const pct = (sold / TOTAL_PLACES) * 100;
  const fill = document.getElementById('counter-progress-fill');
  if (fill) fill.style.width = Math.max(pct, 0.2) + '%';

  // Labels
  const soldLabel = document.getElementById('places-sold-label');
  if (soldLabel) soldLabel.textContent = sold + ' sold';
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent.replace(/,/g, '')) || target;
  const diff = target - start;
  if (diff === 0) { el.textContent = formatNum(target); return; }
  const duration = 800;
  const startTime = performance.now();

  function step(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = formatNum(Math.round(start + diff * eased));
    if (p < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function formatNum(n) {
  return n.toLocaleString('en-IN');
}

// ── Buy UI ────────────────────────────────
function updateBuyUI() {
  const next = getNextPlace();
  const price = getPriceForPlace(next);
  const formattedPrice = formatPrice(price);

  ['current-place-number', 'buy-place-desc', 'buy-btn-place', 'modal-place-num', 'fps-place'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatNum(next);
  });

  ['current-price', 'buy-btn-price', 'fps-amount', 'form-pay-amount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = formattedPrice;
  });

  const nextAfter = next + 1;
  const nextPrice = formatPrice(getPriceForPlace(nextAfter));
  const urgency = document.getElementById('buy-urgency-text');
  if (urgency) urgency.textContent = `Next after this: Place #${formatNum(nextAfter)} for ₹${nextPrice}`;

  if (next > TOTAL_PLACES) {
    const buyBtn = document.getElementById('buy-btn');
    if (buyBtn) {
      buyBtn.disabled = true;
      buyBtn.innerHTML = '<span>🎉 All 50,000 Places Sold!</span>';
      buyBtn.style.opacity = '0.6';
      buyBtn.style.cursor = 'default';
    }
  }
}

// ── Sort & filter ─────────────────────────
function sortLeaderboard(sortBy) {
  currentSort = sortBy;
  document.querySelectorAll('.lb-sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === sortBy);
  });
  renderLeaderboard();
}

function getSortedData() {
  const arr = [...leaderboardData];
  if (currentSort === 'price') arr.sort((a, b) => b.place - a.place);
  else if (currentSort === 'likes') arr.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  else if (currentSort === 'random') arr.sort(() => Math.random() - 0.5);
  return arr;
}

function getFilteredData() {
  const sorted = getSortedData();
  if (!searchQuery) return sorted;
  const q = searchQuery.toLowerCase();
  return sorted.filter(item =>
    (item.name || '').toLowerCase().includes(q) ||
    (item.message || '').toLowerCase().includes(q) ||
    String(item.place || '').includes(q)
  );
}

function onLbSearch() {
  const inp = document.getElementById('lb-search');
  searchQuery = (inp ? inp.value : '').trim().toLowerCase();
  const clearBtn = document.getElementById('lb-search-clear');
  if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
  renderLeaderboard();
}

function clearLbSearch() {
  const inp = document.getElementById('lb-search');
  if (inp) inp.value = '';
  searchQuery = '';
  const clearBtn = document.getElementById('lb-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderLeaderboard();
}

// ── Render leaderboard ────────────────────
function renderLeaderboard() {
  filteredData = getFilteredData();
  displayedCount = 0;

  const body = document.getElementById('lb-table-body');
  const emptyEl = document.getElementById('lb-empty');
  const loadMoreWrap = document.getElementById('lb-load-more-wrap');

  if (!body) return;

  if (filteredData.length === 0) {
    body.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  // Render first batch
  body.innerHTML = '';
  appendRows(ROWS_PER_PAGE);
}

function appendRows(count) {
  const body = document.getElementById('lb-table-body');
  const loadMoreWrap = document.getElementById('lb-load-more-wrap');
  if (!body) return;

  const slice = filteredData.slice(displayedCount, displayedCount + count);
  // Compute global rank for displayed slice
  slice.forEach((item, i) => {
    const globalIndex = displayedCount + i;
    const rankInPriceOrder = currentSort === 'price'
      ? leaderboardData.findIndex(d => d.place === item.place) + 1
      : globalIndex + 1;
    body.insertAdjacentHTML('beforeend', buildRow(item, rankInPriceOrder, globalIndex));
  });

  displayedCount += slice.length;

  // Show / hide load more
  if (loadMoreWrap) {
    loadMoreWrap.style.display = displayedCount < filteredData.length ? 'block' : 'none';
  }
}

function loadMoreRows() {
  appendRows(ROWS_PER_PAGE);
}

function getYoutubeVidId(url) {
  if (!url) return null;
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/);
  return (m && m[2] && m[2].length === 11) ? m[2] : null;
}

let lbmpCurrentPlace = null;   // active place number
let lbmpIsOnCard = false;      // currently overlaying the card
let lbmpRafId = null;          // requestAnimationFrame id
let lbmpScrollBound = null;    // bound scroll handler

// ── Core: update mini-player position every frame ──
function lbmpTick() {
  if (lbmpCurrentPlace === null) return;

  const wrap = document.getElementById(`video-wrap-${lbmpCurrentPlace}`);
  const player = document.getElementById('lb-global-mini-player');
  if (!wrap || !player) return;

  const rect = wrap.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Card is "visible enough" if its video area is substantially in viewport
  const inView = rect.top >= -20 && rect.bottom <= vh + 20
                 && rect.top < vh - 30 && rect.width > 0;

  if (inView) {
    // ── Overlay exactly on the card's video wrap ──
    player.style.position   = 'fixed';
    player.style.top        = Math.max(0, rect.top) + 'px';
    player.style.left       = rect.left + 'px';
    player.style.width      = rect.width + 'px';
    player.style.height     = rect.height + 'px';
    player.style.bottom     = 'auto';
    player.style.right      = 'auto';
    player.style.borderRadius = '23.5px 23.5px 0 0';
    player.style.border     = 'none';
    player.style.boxShadow  = 'none';
    player.style.opacity    = '1';
    player.style.transform  = 'none';
    player.style.transition = 'none';
    player.style.pointerEvents = 'all';
    if (!lbmpIsOnCard) {
      player.classList.add('lbmp-on-card');
      player.classList.remove('lbmp-floating');
      lbmpIsOnCard = true;
    }
  } else {
    // ── Float to bottom-right corner ──
    const floatW = vw <= 640 ? 260 : 352;
    player.style.position   = 'fixed';
    player.style.top        = 'auto';
    player.style.left       = 'auto';
    player.style.bottom     = vw <= 640 ? '16px' : '28px';
    player.style.right      = vw <= 640 ? '16px' : '28px';
    player.style.width      = floatW + 'px';
    player.style.height     = 'auto';
    player.style.border     = '2.5px solid var(--pop-border, #4338ca)';
    player.style.boxShadow  = '0 24px 60px rgba(0,0,0,0.8)';
    player.style.borderRadius = '20px';
    player.style.opacity    = '1';
    player.style.transform  = 'none';
    player.style.transition = 'bottom 0.4s cubic-bezier(0.16,1,0.3,1), right 0.4s cubic-bezier(0.16,1,0.3,1), width 0.38s cubic-bezier(0.16,1,0.3,1), border-radius 0.35s ease, box-shadow 0.3s ease';
    player.style.pointerEvents = 'all';
    if (lbmpIsOnCard) {
      player.classList.remove('lbmp-on-card');
      player.classList.add('lbmp-floating');
      lbmpIsOnCard = false;
    }
  }

  lbmpRafId = requestAnimationFrame(lbmpTick);
}

function lbmpStartTracking() {
  if (lbmpRafId) cancelAnimationFrame(lbmpRafId);
  lbmpRafId = requestAnimationFrame(lbmpTick);
}

function lbmpStopTracking() {
  if (lbmpRafId) { cancelAnimationFrame(lbmpRafId); lbmpRafId = null; }
}

// ── Close / Stop ───────────────────────────
function lbmpClose() {
  lbmpStopTracking();

  // Stop video
  const screen = document.getElementById('lbmp-screen');
  if (screen) screen.innerHTML = '';

  // Restore card thumbnail
  if (lbmpCurrentPlace !== null) {
    const closingPlace = lbmpCurrentPlace;
    const container = document.getElementById(`card-video-${closingPlace}`);
    const vidId = container ? container.dataset.ytid : null;
    if (container && vidId) {
      container.innerHTML = `<img src="https://img.youtube.com/vi/${vidId}/maxresdefault.jpg" alt="YouTube Thumbnail" onerror="this.src='https://img.youtube.com/vi/${vidId}/hqdefault.jpg'">`;
      container.onclick = function(e) { playCardVideo(e, closingPlace, vidId); };
    }
  }

  // Hide mini-player
  const player = document.getElementById('lb-global-mini-player');
  if (player) {
    player.style.opacity   = '0';
    player.style.transform = 'translateY(20px) scale(0.92)';
    player.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    player.style.pointerEvents = 'none';
  }

  lbmpCurrentPlace = null;
  lbmpIsOnCard = false;
}

// ── Jump to card ───────────────────────────
function lbmpScrollToCard() {
  if (lbmpCurrentPlace === null) return;
  const row = document.getElementById(`row-${lbmpCurrentPlace}`);
  if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Play ───────────────────────────────────
function playCardVideo(event, placeNum, vidId) {
  if (event) event.stopPropagation();

  // Stop previous card if different
  if (lbmpCurrentPlace !== null && lbmpCurrentPlace !== placeNum) {
    const prevContainer = document.getElementById(`card-video-${lbmpCurrentPlace}`);
    const prevVidId = prevContainer ? prevContainer.dataset.ytid : null;
    if (prevContainer && prevVidId) {
      prevContainer.innerHTML = `<img src="https://img.youtube.com/vi/${prevVidId}/maxresdefault.jpg" alt="YouTube Thumbnail" onerror="this.src='https://img.youtube.com/vi/${prevVidId}/hqdefault.jpg'">`;
      (function(pp, pv){ prevContainer.onclick = function(e){ playCardVideo(e, pp, pv); }; })(lbmpCurrentPlace, prevVidId);
    }
  }

  lbmpCurrentPlace = placeNum;

  // Mark card container so we know what's playing
  const container = document.getElementById(`card-video-${placeNum}`);
  if (container) {
    container.dataset.ytid = vidId;
    container.onclick = null; // disable click while playing
  }

  // Load iframe into global mini-player (only if not already loaded with same video)
  const screen = document.getElementById('lbmp-screen');
  const titleEl = document.getElementById('lbmp-title');
  if (screen && !screen.querySelector('iframe[data-vid="' + vidId + '"]')) {
    screen.innerHTML = `<iframe data-vid="${vidId}" src="https://www.youtube.com/embed/${vidId}?autoplay=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;display:block;"></iframe>`;
  }
  if (titleEl) titleEl.textContent = `▶ Place #${placeNum}`;

  // Make player visible (position will be set by first tick)
  const player = document.getElementById('lb-global-mini-player');
  if (player) {
    player.style.opacity    = '1';
    player.style.transform  = 'none';
    player.style.pointerEvents = 'all';
    player.style.transition = 'opacity 0.2s ease';
  }

  lbmpIsOnCard = false; // force re-evaluation on first tick
  lbmpStartTracking();
}

function scrollToCard(event, placeNum) {
  if (event) event.stopPropagation();
  const row = document.getElementById(`row-${placeNum}`);
  if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function formatCardMessage(msg, placeNum) {
  const rawText = msg || '—';
  const charLimit = 85;
  if (rawText.length <= charLimit) {
    return `“${escapeHtml(rawText)}”`;
  }
  const shortText = escapeHtml(rawText.slice(0, charLimit).trim()) + '...';
  const fullText = escapeHtml(rawText);
  return `
    <span class="msg-short" id="msg-short-${placeNum}">“${shortText} <button class="lb-msg-more" onclick="toggleMsgExpand(event, ${placeNum}, true)">more</button>”</span>
    <span class="msg-full" id="msg-full-${placeNum}" style="display:none;">“${fullText} <button class="lb-msg-less" onclick="toggleMsgExpand(event, ${placeNum}, false)">less</button>”</span>
  `;
}

function buildRow(item, displayRank, globalIndex) {
  const liked = isLiked(item.id || item.place);

  const avatarSrc = item.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'A')}&background=7c3aed&color=fff&size=200`;

  const ytId = getYoutubeVidId(item.youtubeUrl || 'https://www.youtube.com/watch?v=jfKfPfyJRdk') || 'jfKfPfyJRdk';
  const thumbUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;

  return `
  <div class="lb-card${liked ? ' liked-card' : ''}" id="row-${item.place}" onclick="window.location.href='profile.html?place=${item.place}'">
    
    <!-- SECTION 1: YouTube Video (Full 16:9 Standard Size Thumbnail without play button, hashtag or reel tags) -->
    <div class="lb-card-video-wrap" id="video-wrap-${item.place}">
      <div class="lb-card-video" id="card-video-${item.place}" onclick="playCardVideo(event, ${item.place}, '${ytId}')" title="Click to play YouTube Video">
        <img src="${thumbUrl}" alt="YouTube Thumbnail" onerror="this.src='https://img.youtube.com/vi/${ytId}/hqdefault.jpg'">
      </div>
    </div>

    <!-- SECTION 2: Profile Picture, Hashtag Badge, Message, Likes -->
    <div class="lb-card-content">
      <div class="lb-card-user">
        <img class="lb-card-avatar" src="${avatarSrc}" alt="${escapeHtml(item.name || '')}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'A')}&background=333&color=fff&size=200'">
        <div class="lb-card-user-info">
          <div class="lb-card-user-top">
            <div class="lb-card-name">${escapeHtml(item.name || 'Anonymous')}</div>
            <span class="lb-card-place-pill">#${item.place}</span>
          </div>
          <a href="profile.html?place=${item.place}" class="lb-card-visit" onclick="event.stopPropagation()">Visit Profile ↗</a>
        </div>
      </div>

      <div class="lb-card-message">
        ${formatCardMessage(item.message, item.place)}
      </div>

      <div class="lb-card-foot">
        <button class="lb-card-like-btn${liked ? ' liked' : ''}" id="like-btn-${item.place}" onclick="toggleLike(event, ${item.place})" aria-label="Like ${escapeHtml(item.name || '')}">
          <span class="like-heart">${liked ? '❤️' : '🤍'}</span>
          <span class="lb-like-count" id="like-count-${item.place}">${formatLikes(item.likes || 0)}</span>
        </button>
        <span class="lb-card-price-chip">₹${formatPrice(getPriceForPlace(item.place))}</span>
      </div>
    </div>

  </div>`;
}

// ── Message expand ─────────────────────────
function toggleMsgExpand(event, placeNum, expand) {
  if (event) event.stopPropagation();
  const shortEl = document.getElementById(`msg-short-${placeNum}`);
  const fullEl = document.getElementById(`msg-full-${placeNum}`);
  if (!shortEl || !fullEl) return;
  if (expand) {
    shortEl.style.display = 'none';
    fullEl.style.display = 'inline';
  } else {
    shortEl.style.display = 'inline';
    fullEl.style.display = 'none';
  }
}

// ── Likes ─────────────────────────────────
function toggleLike(event, placeNum) {
  event.stopPropagation();
  const item = leaderboardData.find(d => d.place === placeNum);
  if (!item) return;

  const likedSet = getLikedSet();
  const id = item.id || item.place;

  if (likedSet.has(id)) {
    item.likes = Math.max(0, (item.likes || 0) - 1);
    likedSet.delete(id);
  } else {
    item.likes = (item.likes || 0) + 1;
    likedSet.add(id);
  }

  saveLikedSet(likedSet);
  saveData();

  // Update count & button
  const countEl = document.getElementById(`like-count-${placeNum}`);
  if (countEl) countEl.textContent = formatLikes(item.likes);

  const btn = document.getElementById(`like-btn-${placeNum}`);
  const isNowLiked = likedSet.has(id);
  if (btn) {
    btn.classList.toggle('liked', isNowLiked);
    const heart = btn.querySelector('.like-heart');
    if (heart) heart.textContent = isNowLiked ? '❤️' : '🤍';
    btn.classList.add('like-pop');
    btn.addEventListener('animationend', () => btn.classList.remove('like-pop'), { once: true });
  }

  const rowEl = document.getElementById(`row-${placeNum}`);
  if (rowEl) {
    rowEl.classList.toggle('liked-row', isNowLiked);
    rowEl.classList.toggle('liked-card', isNowLiked);
    
    if (isNowLiked) {
      rowEl.classList.add('card-shake');
      rowEl.addEventListener('animationend', () => {
        rowEl.classList.remove('card-shake');
      }, { once: true });
      
      if (btn) throwHearts(btn);
    }
  }
}

// ── Heart Confetti Effect ──────────────────
function throwHearts(element) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2 + window.scrollX;
  const centerY = rect.top + rect.height / 2 + window.scrollY;

  for (let i = 0; i < 10; i++) {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.textContent = Math.random() > 0.5 ? '❤️' : '💖';
    heart.style.left = `${centerX}px`;
    heart.style.top = `${centerY}px`;

    // Random spread (30 to 150 degrees)
    const angle = (Math.random() * 120 + 30) * Math.PI / 180;
    const velocity = 60 + Math.random() * 80;
    const tx = Math.cos(angle) * velocity;
    const ty = -Math.sin(angle) * velocity;

    heart.style.setProperty('--tx', `${tx}px`);
    heart.style.setProperty('--ty', `${ty}px`);
    heart.style.fontSize = `${14 + Math.random() * 14}px`;

    document.body.appendChild(heart);

    heart.addEventListener('animationend', () => {
      heart.remove();
    });
  }
}

function getLikedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem('top15000_liked') || '[]'));
  } catch { return new Set(); }
}

function saveLikedSet(set) {
  try {
    localStorage.setItem('top15000_liked', JSON.stringify([...set]));
  } catch { }
}

function isLiked(id) {
  return getLikedSet().has(id);
}

function formatLikes(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

// ── Buy modal ─────────────────────────────
function openBuyModal() {
  const next = getNextPlace();
  if (next > TOTAL_PLACES) return;

  // Sync modal values
  updateBuyUI();
  document.getElementById('buy-modal').classList.add('show');
  document.getElementById('buy-form').reset();
  updateCharCount();
}

function closeBuyModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('buy-modal').classList.remove('show');
}

function handleBuySubmit(event) {
  event.preventDefault();

  const name = (document.getElementById('form-name').value || '').trim();
  const profileUrl = (document.getElementById('form-profile').value || '').trim();
  const youtubeUrlInput = document.getElementById('form-youtube');
  const youtubeUrl = youtubeUrlInput ? (youtubeUrlInput.value || '').trim() : '';
  const message = (document.getElementById('form-message').value || '').trim();

  if (!name) { showToast('Please enter your name'); return; }

  const next = getNextPlace();
  if (next > TOTAL_PLACES) {
    showToast('All 50,000 places are sold out!');
    return;
  }

  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff&size=200`;
  const newEntry = {
    id: next,
    place: next,
    name,
    profilePicture: profileUrl || fallback,
    youtubeUrl: youtubeUrl || 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    message: message || 'I claimed my permanent place on the internet!',
    likes: 0
  };

  leaderboardData.push(newEntry);
  // Keep strictly sorted by place
  leaderboardData.sort((a, b) => a.place - b.place);
  saveData();

  closeBuyModal({ target: document.getElementById('buy-modal'), currentTarget: document.getElementById('buy-modal') });
  updateCounterUI();
  updateBuyUI();
  renderLeaderboard();

  showToast(`🎉 Congrats! You now own Place #${next} forever!`);
}

// ── Char counter ──────────────────────────
function setupCharCounter() {
  const textarea = document.getElementById('form-message');
  if (!textarea) return;
  textarea.addEventListener('input', updateCharCount);
}

function updateCharCount() {
  const textarea = document.getElementById('form-message');
  const counter = document.getElementById('form-char-remaining');
  if (!textarea || !counter) return;
  const remaining = 300 - textarea.value.length;
  counter.textContent = remaining;
  counter.style.color = remaining < 30 ? '#ef4444' : remaining < 80 ? '#f5c842' : '';
}

// ── Toast ─────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Utility ───────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ── Bootstrap ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  init();
  const saved = localStorage.getItem('top15000_theme') || 'light';
  updateThemeIcon(saved);
});

// ── Theme Toggle ──────────────────────────
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('top15000_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  document.querySelectorAll('.theme-icon').forEach(el => {
    el.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
}

// ── Dynamic Background Aura ────────────────
function applyDynamicBackground() {
  const bgEl = document.getElementById('user-ambient-bg');
  if (!bgEl) return;

  const colors = ['#7c3aed', '#e91e8c', '#0d9488', '#f59e0b', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  
  bgEl.style.background = `radial-gradient(circle at 50% 50%, #ffffff 0%, ${randomColor} 70%)`;
}
