// ==========================================
// CREATOR'S PYRAMID — PROFILE PAGE JS v4.0
// Decoupled CDN Architecture + Supabase RPC
// ==========================================

const CDN_BASE = 'https://data.creatorspyramid.com';
const SUPABASE_URL = 'https://conecotzzmloenikxefo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvbmVjb3R6em1sb2VuaWt4ZWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTg5NzksImV4cCI6MjA5ODI3NDk3OX0.M5llBovp2kS6s83ZOIxETYKoRl6dFcF-96Fkc53XHQM';

const PALETTES = ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

let currentUser = null;

function getPriceForId(id) {
  return +(1 + (id - 1) * 0.03).toFixed(2);
}

function formatPrice(num) {
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

function formatLikes(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n || 0);
}

// ── Device fingerprint for like tracking ──────────────────
function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem('device_fingerprint');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_fingerprint', deviceId);
  }
  return deviceId;
}

// ── Liked set persistence ──────────────────────────────
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

// ── Optimistic Max Likes ───────────────────────────────
function getLocalMaxLikes() {
  try {
    return JSON.parse(localStorage.getItem('top15000_max_likes') || '{}');
  } catch { return {}; }
}

function saveLocalMaxLikes(map) {
  try {
    localStorage.setItem('top15000_max_likes', JSON.stringify(map));
  } catch { }
}

// ── Sent likes persistence (permanent record) ──────────
function getSentLikesSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem('top15000_sent_likes') || '[]'));
  } catch { return new Set(); }
}

function saveSentLikesSet(set) {
  try {
    localStorage.setItem('top15000_sent_likes', JSON.stringify([...set]));
  } catch { }
}

// ── Supabase RPC call ──────────────────────────────────
async function supabaseRpc(fnName, params) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Supabase RPC error (${res.status}):`, errBody);
    }
  } catch (err) {
    console.error('Error calling Supabase RPC:', err);
  }
}

// ── Initialize ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('top15000_theme') || 'light';
  updateThemeIcon(savedTheme);
  initProfile();
});

async function initProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('id');
  const placeNum = parseInt(urlParams.get('place'), 10) || 1;

  if (userId) {
    try {
      // ── Step 1: Try to get like count from localStorage (cached by main page SWR) ──
      let likeCount = 0;
      let needsLikeFetch = true;

      try {
        const cached = JSON.parse(localStorage.getItem('master_data') || 'null');
        if (cached && cached.ids && cached.likes) {
          const idx = cached.ids.indexOf(Number(userId));
          if (idx !== -1) {
            likeCount = cached.likes[idx] || 0;
            needsLikeFetch = false; // We have fresh-enough data, skip the heavy fetch
          }
        }
      } catch {}

      // Apply optimistic max likes on top of cached data
      const maxMap = getLocalMaxLikes();
      if (maxMap[userId] && maxMap[userId] > likeCount) {
        likeCount = maxMap[userId];
      }

      // ── Step 2: Fetch user.json (tiny ~200 bytes) — always needed ──
      // If we don't have cached likes, also fetch like.json in parallel (direct link open)
      let userRes;
      if (needsLikeFetch) {
        // No cached master_data — user opened profile directly, need both
        const [uRes, likeRes] = await Promise.all([
          fetch(`${CDN_BASE}/users/${userId}.json`, { cache: "no-cache" }),
          fetch(`${CDN_BASE}/like.json`, { cache: "no-cache" })
        ]);
        userRes = uRes;

        if (likeRes.ok) {
          const likeData = await likeRes.json();
          const idsArr = likeData.ids || [];
          const likesArr = likeData.likes || [];
          const idx = idsArr.indexOf(Number(userId));
          if (idx !== -1) {
            const serverLikes = likesArr[idx] || 0;
            if (maxMap[userId] && maxMap[userId] > serverLikes) {
              likeCount = maxMap[userId];
            } else {
              likeCount = serverLikes;
              maxMap[userId] = serverLikes;
              saveLocalMaxLikes(maxMap);
            }
          }
          // Cache this for future use (same format as main page)
          try {
            localStorage.setItem('master_data', JSON.stringify(likeData));
          } catch {}
        }
      } else {
        // We already have cached likes — only fetch the tiny user JSON
        userRes = await fetch(`${CDN_BASE}/users/${userId}.json`, { cache: "no-cache" });
      }

      if (userRes.ok) {
        const userData = await userRes.json();
        const color = PALETTES[placeNum % PALETTES.length];
        const paymentId = userData.payment_id || userData.id || userId;
        currentUser = {
          place: placeNum,
          id: userData.id || userId,
          name: userData.name_on_card || `Creator #${placeNum}`,
          profilePicture: userData.profile_image_upload || userData.profile_image || `${CDN_BASE}/profiles/${paymentId}.jpeg`,
          message: userData.message_on_card || '',
          youtubeUrl: userData.youtube_url || '',
          instagramUrl: userData.instagram_social_url || '',
          likes: likeCount,
          color: color
        };
      }

    } catch (e) {
      console.error('Error fetching user data:', e);
    }
  }

  if (!currentUser) {
    const color = PALETTES[placeNum % PALETTES.length];
    currentUser = {
      place: placeNum,
      id: placeNum,
      name: 'Not Claimed',
      profilePicture: `https://ui-avatars.com/api/?name=Empty&background=${color.replace('#', '')}&color=fff&size=200`,
      message: 'This place has not been claimed yet, or the data is still syncing.',
      youtubeUrl: '',
      instagramUrl: '',
      likes: 0,
      color: color
    };
  }

  applyPersonalizedAura();
  renderUserProfile();
}

function applyPersonalizedAura() {
  const color = currentUser.color || PALETTES[currentUser.place % PALETTES.length];
  document.documentElement.style.setProperty('--user-accent', color);
  document.documentElement.style.setProperty('--user-glow', hexToRgba(color, 0.45));
}

function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const r = parseInt(c.substring(0, 2), 16) || 99;
  const g = parseInt(c.substring(2, 4), 16) || 102;
  const b = parseInt(c.substring(4, 6), 16) || 241;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderUserProfile() {
  if (!currentUser) return;
  const p = currentUser.place;

  const avatarSrc = currentUser.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=6366f1&color=fff&size=200`;
  const bgEl = document.getElementById('user-ambient-bg');
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
    bgEl.style.backgroundImage = 'none';
    bgEl.style.background = `radial-gradient(circle at 50% 50%, #ffffff 0%, ${randomColor} 70%)`;
  }

  const placeBadgeEl = document.getElementById('place-pill');
  if (placeBadgeEl) placeBadgeEl.textContent = `#${p}`;

  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    avatarEl.src = avatarSrc;
  }

  const nameEl = document.getElementById('profile-name');
  if (nameEl) nameEl.textContent = currentUser.name || `Citizen #${p}`;

  const priceEl = document.getElementById('profile-price');
  if (priceEl) priceEl.textContent = `Claimed for ₹${formatPrice(getPriceForId(parseInt(currentUser.id, 10) || 1))}`;

  const msgEl = document.getElementById('profile-message');
  if (msgEl) {
    const rawMsg = currentUser.message || 'No inscription provided.';
    // Convert newlines to spaces for character count checking if needed, or just check length
    if (rawMsg.length > 90) {
      msgEl.innerHTML = `
        <div class="lb-card-message-text" id="profile-msg-text">"${rawMsg}"</div>
        <button class="lb-message-more-btn" id="profile-msg-more-btn" onclick="toggleMessageExpand()">more</button>
      `;
    } else {
      msgEl.innerHTML = `<div class="lb-card-message-text" id="profile-msg-text" style="display: block; -webkit-line-clamp: unset; max-height: none;">"${rawMsg}"</div>`;
    }
  }

  // Render YouTube thumbnail
  const ytId = getYoutubeVidId(currentUser.youtubeUrl || 'https://www.youtube.com/watch?v=jfKfPfyJRdk') || 'jfKfPfyJRdk';
  const thumbUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
  const videoThumbEl = document.getElementById('profile-video-thumb');
  if (videoThumbEl) {
    videoThumbEl.src = thumbUrl;
    videoThumbEl.onerror = () => {
      videoThumbEl.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    };
  }

  // Render social links
  const socialLinksEl = document.getElementById('profile-social-links');
  if (socialLinksEl) {
    let socialHTML = '';
    if (currentUser.youtubeUrl) {
      socialHTML += `<a href="${currentUser.youtubeUrl}" target="_blank" rel="noopener noreferrer" class="profile-social-link profile-social-yt" title="YouTube">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        <span>YouTube</span>
      </a>`;
    }
    if (currentUser.instagramUrl) {
      socialHTML += `<a href="${currentUser.instagramUrl}" target="_blank" rel="noopener noreferrer" class="profile-social-link profile-social-ig" title="Instagram">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
        <span>Instagram</span>
      </a>`;
    }
    socialLinksEl.innerHTML = socialHTML;
  }

  updateLikesUI();

  // Completely remove skeleton loader from DOM and show profile card + action buttons
  const skeletonEl = document.getElementById('profile-skeleton');
  if (skeletonEl) {
    skeletonEl.style.setProperty('display', 'none', 'important');
    skeletonEl.remove();
  }

  const cardEl = document.getElementById('profile-card');
  if (cardEl) {
    cardEl.classList.remove('hidden-card');
    cardEl.style.setProperty('display', 'flex', 'important');
  }

  const actionsEl = document.getElementById('profile-actions');
  if (actionsEl) {
    actionsEl.style.opacity = '1';
    actionsEl.style.pointerEvents = 'auto';
    actionsEl.style.animation = 'profileActionsReveal 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s forwards';
  }
}

function updateLikesUI() {
  const likedSet = getLikedSet();
  const id = currentUser.id;
  const liked = likedSet.has(id);

  const countEl = document.getElementById('profile-like-count');
  if (countEl) countEl.textContent = `${(currentUser.likes || 0).toLocaleString()} Likes`;

  const heartEl = document.getElementById('profile-heart');
  if (heartEl) heartEl.textContent = liked ? '❤️' : '🤍';

  const btnEl = document.getElementById('profile-like-btn');
  if (btnEl) btnEl.classList.toggle('liked', liked);
}

function likeProfile() {
  if (!currentUser) return;

  const id = currentUser.id;
  const likedSet = getLikedSet();
  const sentLikes = getSentLikesSet();
  const isCurrentlyLiked = likedSet.has(id);

  if (isCurrentlyLiked) {
    // Unlike — UI only, never touches Supabase
    currentUser.likes = Math.max(0, (currentUser.likes || 0) - 1);
    likedSet.delete(id);
    saveLikedSet(likedSet);
    
    // Update local max so it doesn't stubbornly hold onto the +1 if we unliked
    const maxMap = getLocalMaxLikes();
    maxMap[id] = currentUser.likes;
    saveLocalMaxLikes(maxMap);

    updateLikesUI();
    return;
  }

  // Like — increment UI immediately
  currentUser.likes = (currentUser.likes || 0) + 1;
  likedSet.add(id);
  saveLikedSet(likedSet);

  // Store new optimistic high-water mark
  const maxMap = getLocalMaxLikes();
  maxMap[id] = currentUser.likes;
  saveLocalMaxLikes(maxMap);

  updateLikesUI();

  const btn = document.getElementById('profile-like-btn');
  if (btn) {
    btn.classList.add('like-pop');
    setTimeout(() => btn.classList.remove('like-pop'), 400);
    throwHearts(btn);
  }

  const card = document.getElementById('profile-card');
  if (card) {
    card.classList.add('card-shake');
    card.addEventListener('animationend', () => {
      card.classList.remove('card-shake');
    }, { once: true });
  }

  // Only send to Supabase if we haven't sent for this ID before
  if (!sentLikes.has(id)) {
    sentLikes.add(id);
    saveSentLikesSet(sentLikes);

    supabaseRpc('process_card_like', {
      target_id: id,
      client_device_id: getOrCreateDeviceId()
    });
  }
}

function toggleMessageExpand() {
  const textEl = document.getElementById('profile-msg-text');
  const btnEl = document.getElementById('profile-msg-more-btn');
  if (!textEl || !btnEl) return;
  
  if (textEl.classList.contains('expanded')) {
    textEl.classList.remove('expanded');
    btnEl.textContent = 'more';
  } else {
    textEl.classList.add('expanded');
    btnEl.textContent = 'less';
  }
}

function shareProfile() {
  const url = window.location.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('⚡ Monument Link Copied to Clipboard!');
    }).catch(() => {
      showToast('⚡ Monument URL: ' + url);
    });
  } else {
    showToast('⚡ Monument URL: ' + url);
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

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

// ── YouTube Video Utils ────────────────────
function getYoutubeVidId(url) {
  if (!url) return null;
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/);
  return (m && m[2] && m[2].length === 11) ? m[2] : null;
}

function playCardVideo() {
  const container = document.getElementById('card-video-profile');
  if (!container || !currentUser) return;
  const ytId = getYoutubeVidId(currentUser.youtubeUrl || 'https://www.youtube.com/watch?v=jfKfPfyJRdk') || 'jfKfPfyJRdk';
  container.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;display:block;"></iframe>`;
}



// ── Heart Confetti Effect (pooled — no DOM leaks) ────────
const HEART_POOL_SIZE = 20;
let _heartPool = [];
let _heartPoolReady = false;

function initProfileHeartPool() {
  if (_heartPoolReady) return;
  for (let i = 0; i < HEART_POOL_SIZE; i++) {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.style.display = 'none';
    heart.style.willChange = 'transform, opacity';
    document.body.appendChild(heart);
    _heartPool.push(heart);
  }
  _heartPoolReady = true;
}

function throwHearts(element) {
  if (!element) return;
  initProfileHeartPool();
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2 + window.scrollX;
  const centerY = rect.top + rect.height / 2 + window.scrollY;

  const heartsToUse = Math.min(10, _heartPool.length);
  for (let i = 0; i < heartsToUse; i++) {
    const heart = _heartPool[i];
    if (!heart) continue;

    heart.textContent = Math.random() > 0.5 ? '❤️' : '💖';
    heart.style.left = `${centerX}px`;
    heart.style.top = `${centerY}px`;
    heart.style.display = 'block';

    const angle = (Math.random() * 120 + 30) * Math.PI / 180;
    const velocity = 60 + Math.random() * 80;
    const tx = Math.cos(angle) * velocity;
    const ty = -Math.sin(angle) * velocity;

    heart.style.setProperty('--tx', `${tx}px`);
    heart.style.setProperty('--ty', `${ty}px`);
    heart.style.fontSize = `${14 + Math.random() * 14}px`;

    heart.classList.remove('floating-heart');
    void heart.offsetWidth; // force reflow for animation restart
    heart.classList.add('floating-heart');

    const hideTimer = setTimeout(() => {
      heart.style.display = 'none';
      clearTimeout(hideTimer);
    }, 1200);
  }
}
