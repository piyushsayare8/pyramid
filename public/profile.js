// ==========================================
// TOP50000.COM — PURE LIVING MONUMENT JS v3.0
// ==========================================

const SAMPLE_BUYERS = [
  {
    place: 1, name: 'Arjun Mehta',
    profilePicture: 'https://ui-avatars.com/api/?name=Arjun+Mehta&background=7c3aed&color=fff&size=200',
    message: 'First is first. No one can take this from me. History is written by those who act first! 🚀',
    likes: 142, color: '#7c3aed'
  },
  {
    place: 2, name: 'Priya Sharma',
    profilePicture: 'https://ui-avatars.com/api/?name=Priya+Sharma&background=e91e8c&color=fff&size=200',
    message: 'Dreamer, builder, believer. Proud to hold Place #2 on the most exclusive internet list ever made.',
    likes: 98, color: '#e91e8c'
  },
  {
    place: 3, name: 'Rohan Das',
    profilePicture: 'https://ui-avatars.com/api/?name=Rohan+Das&background=0d9488&color=fff&size=200',
    message: 'Top 3 baby! Invested ₹3 and got a piece of internet history. Future generations will know this name. 🔥',
    likes: 77, color: '#0d9488'
  },
  {
    place: 4, name: 'Sneha Patel',
    profilePicture: 'https://ui-avatars.com/api/?name=Sneha+Patel&background=f59e0b&color=fff&size=200',
    message: 'Small price, big legacy. Every great journey begins with a single step — or in this case, ₹4.',
    likes: 61, color: '#f59e0b'
  },
  {
    place: 5, name: 'Vikram Nair',
    profilePicture: 'https://ui-avatars.com/api/?name=Vikram+Nair&background=2563eb&color=fff&size=200',
    message: 'Place #5! I\'m part of the elite Top 10 forever. No amount of money can change history. 🌟',
    likes: 54, color: '#2563eb'
  },
  {
    place: 6, name: 'Kavya Reddy',
    profilePicture: 'https://ui-avatars.com/api/?name=Kavya+Reddy&background=dc2626&color=fff&size=200',
    message: 'Six is my lucky number and this is my lucky place. Seize every opportunity that comes your way!',
    likes: 43, color: '#dc2626'
  },
  {
    place: 7, name: 'Amit Kumar',
    profilePicture: 'https://ui-avatars.com/api/?name=Amit+Kumar&background=16a34a&color=fff&size=200',
    message: 'Lucky number 7. When I saw this site I knew I had to grab a spot. Best ₹7 I ever spent. Seriously.',
    likes: 39, color: '#16a34a'
  },
  {
    place: 8, name: 'Divya Singh',
    profilePicture: 'https://ui-avatars.com/api/?name=Divya+Singh&background=9333ea&color=fff&size=200',
    message: 'Eternal optimist. Permanent dreamer. Place #8 on the internet — forever. This is my digital legacy. ✨',
    likes: 35, color: '#9333ea'
  },
  {
    place: 9, name: 'Rajan Iyer',
    profilePicture: 'https://ui-avatars.com/api/?name=Rajan+Iyer&background=ea580c&color=fff&size=200',
    message: 'Nine lives, one permanent digital spot. The internet never forgets, and I am now part of it forever.',
    likes: 28, color: '#ea580c'
  },
  {
    place: 10, name: 'Meena Gupta',
    profilePicture: 'https://ui-avatars.com/api/?name=Meena+Gupta&background=0891b2&color=fff&size=200',
    message: 'Double digits! Proud to be in the Top 10. In a world of 8 billion people, only 10 got here first. 💎',
    likes: 22, color: '#0891b2'
  }
];

const PALETTES = ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

let currentUser = null;

function getPriceForPlace(place) {
  if (place <= 10) return 1;
  return +(1 + (place - 10) * 0.1).toFixed(2);
}

function formatPrice(num) {
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('top15000_theme') || 'light';
  updateThemeIcon(savedTheme);
  initProfile();
  loadDynamicWallpaper(false);
});

function initProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const placeNum = parseInt(urlParams.get('place'), 10) || 1;

  let data = [];
  try {
    const stored = localStorage.getItem('top15000_data_v1');
    if (stored) data = JSON.parse(stored);
    else data = SAMPLE_BUYERS;
  } catch {
    data = SAMPLE_BUYERS;
  }

  currentUser = data.find(d => d.place === placeNum);

  if (!currentUser) {
    const color = PALETTES[placeNum % PALETTES.length];
    currentUser = {
      place: placeNum,
      id: placeNum,
      name: `Citizen #${placeNum}`,
      profilePicture: `https://ui-avatars.com/api/?name=Citizen+${placeNum}&background=${color.replace('#', '')}&color=fff&size=200`,
      message: `Proud verified citizen of Place #${placeNum} on Top50000.com! My permanent mark on the internet grid.`,
      likes: Math.floor(Math.random() * 45) + 12,
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
  if (bgEl) bgEl.style.backgroundImage = `url('${avatarSrc}')`;

  const placeBadgeEl = document.getElementById('place-pill');
  if (placeBadgeEl) placeBadgeEl.textContent = `#${p}`;

  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) avatarEl.src = avatarSrc;

  const nameEl = document.getElementById('profile-name');
  if (nameEl) nameEl.textContent = currentUser.name || `Citizen #${p}`;

  const priceEl = document.getElementById('profile-price');
  if (priceEl) priceEl.textContent = `Claimed for ₹${formatPrice(getPriceForPlace(p))}`;

  const msgEl = document.getElementById('profile-message');
  if (msgEl) msgEl.textContent = `“${currentUser.message || 'No inscription provided.'}”`;

  updateLikesUI();
}

function updateLikesUI() {
  const likedSet = getLikedSet();
  const id = currentUser.id || currentUser.place;
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
  const id = currentUser.id || currentUser.place;
  const likedSet = getLikedSet();

  if (likedSet.has(id)) {
    currentUser.likes = Math.max(0, (currentUser.likes || 0) - 1);
    likedSet.delete(id);
  } else {
    currentUser.likes = (currentUser.likes || 0) + 1;
    likedSet.add(id);
  }

  saveLikedSet(likedSet);

  try {
    let stored = JSON.parse(localStorage.getItem('top15000_data_v1') || '[]');
    const idx = stored.findIndex(d => d.place === currentUser.place);
    if (idx !== -1) {
      stored[idx].likes = currentUser.likes;
      localStorage.setItem('top15000_data_v1', JSON.stringify(stored));
    }
  } catch { }

  updateLikesUI();

  const btn = document.getElementById('profile-like-btn');
  if (btn) {
    btn.classList.add('like-pop');
    setTimeout(() => btn.classList.remove('like-pop'), 400);
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

// ── Dynamic Free API Wallpaper ────────────
function loadDynamicWallpaper(showNotification = true) {
  const wallpaperEl = document.getElementById('dynamic-wallpaper');
  if (!wallpaperEl) return;

  if (showNotification) {
    showToast('🎨 Fetching aesthetic background from API...');
  }

  const randomSeed = Math.floor(Math.random() * 999999);
  const imgUrl = `https://picsum.photos/seed/${randomSeed}/1920/1080?blur=2`;

  const tempImg = new Image();
  tempImg.onload = () => {
    wallpaperEl.style.opacity = '0';
    setTimeout(() => {
      wallpaperEl.style.backgroundImage = `url('${imgUrl}')`;
      wallpaperEl.style.opacity = '0.88';
      if (showNotification) showToast('✨ Background wallpaper updated!');
    }, 250);
  };
  tempImg.onerror = () => {
    if (showNotification) showToast('⚡ Using ambient default background');
  };
  tempImg.src = imgUrl;
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
