// ========================================
// INSTA CARDS — JAVASCRIPT v7.0
// ========================================

const DATA_VERSION = 9; // bump to force-clear old localStorage

// ── Sample data ───────────────────────────────────────────────────────────────
const sampleData = [
    {
        id: 1,
        name: "Creative Artist",
        profilePicture: "assets/profiles/5000.jpg",
        coverImage: "assets/profiles/5000.jpg",
        message: "Creating amazing content daily! Follow for more inspiration and creative adventures across all platforms",
        reelLink: "https://www.instagram.com/reel/DZ4f05ATGsf/",
        price: 5000,
        likes: 0
    },
    {
        id: 2,
        name: "Tech Influencer",
        profilePicture: "assets/profiles/1000.jpg",
        coverImage: "assets/profiles/image.png",
        message: "Latest tech reviews and tutorials and many more things as we go on and we will do our best to get anything so keep trying you have great future okay.",
        reelLink: "https://www.instagram.com/reel/DYK1M4tTxeS/?igsh=cmtpd3Q1cWRkMzc3",
        price: 3500,
        likes: 0
    },
    {
        id: 3,
        name: "Food Blogger",
        profilePicture: "assets/profiles/500.jpg",
        coverImage: "assets/profiles/500.jpg",
        message: "Delicious recipes from around the world",
        reelLink: "https://www.instagram.com/reel/DWgxI5nic5P/?igsh=MTdhNmFvbHJwdmc1dw==",
        price: 2500,
        likes: 0
    },
    {
        id: 4,
        name: "Music Curator",
        profilePicture: "assets/profiles/image.png",
        coverImage: "assets/profiles/image.png",
        message: "Listen to the top trending music hits of the week",
        reelLink: "https://www.youtube.com/watch?v=a18py61_F_w&list=RDa18py61_F_w&start_radio=1",
        price: 6500,
        likes: 0
    },
    {
        id: 5,
        name: "Shorts Creator",
        profilePicture: "assets/profiles/100.jpg",
        coverImage: "assets/profiles/100.jpg",
        message: "Mind-bending daily coding animations",
        reelLink: "https://www.youtube.com/shorts/Ae-5-2yXOu4",
        price: 1500,
        likes: 0
    }
];

// ── State ─────────────────────────────────────────────────────────────────────
let leaderboardData = [];
let currentSort = 'price';
let searchQuery = '';

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
    loadLocalData();
    renderInstaCards();
    updateSearchClearBtn();

    // Collapse any open read-more when clicking outside cards
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.reel-thumbnail-card, .yt-video-card')) {
            collapseAllReadMore();
        }
    });
}

// ── Data persistence ──────────────────────────────────────────────────────────
function loadLocalData() {
    try {
        const storedVersion = parseInt(localStorage.getItem('instagramLeaderboardVersion') || '0');

        // If version mismatch, wipe old data and start fresh
        if (storedVersion !== DATA_VERSION) {
            localStorage.removeItem('instagramLeaderboardData');
            localStorage.removeItem('likedCards');
            localStorage.removeItem('viewedCards');
            localStorage.setItem('instagramLeaderboardVersion', String(DATA_VERSION));
            leaderboardData = [...sampleData];
            saveLocalData();
            return;
        }

        const stored = localStorage.getItem('instagramLeaderboardData');
        if (stored) {
            leaderboardData = JSON.parse(stored);
            // Migrate: ensure required fields exist
            leaderboardData.forEach(item => {
                if (!item.likes) item.likes = 0;
                if (!item.id) item.id = Date.now() + Math.random();
                if (!item.reelLink) item.reelLink = '#';
                if (!item.message) item.message = '';
                if (!item.name) item.name = 'Unknown';
                if (!item.price) item.price = 0;
                // Migrate: set coverImage = profilePicture if missing
                if (!item.coverImage) item.coverImage = item.profilePicture || '';
            });
            saveLocalData();
        } else {
            leaderboardData = [...sampleData];
            saveLocalData();
        }
    } catch (e) {
        console.warn('localStorage error, resetting data:', e);
        leaderboardData = [...sampleData];
        try {
            localStorage.clear();
            localStorage.setItem('instagramLeaderboardVersion', String(DATA_VERSION));
            saveLocalData();
        } catch (_) { /* storage may be blocked */ }
    }
}

function saveLocalData() {
    try {
        localStorage.setItem('instagramLeaderboardData', JSON.stringify(leaderboardData));
    } catch (e) { console.warn('Could not save data:', e); }
}

// ── Safe btoa for Unicode strings ─────────────────────────────────────────────
function safeEncode(item) {
    try {
        // Use encodeURIComponent to handle Unicode, then btoa
        const json = JSON.stringify(item);
        const encoded = btoa(unescape(encodeURIComponent(json)));
        return encodeURIComponent(encoded);
    } catch (e) {
        return '';
    }
}

// ── Viewed tracking ───────────────────────────────────────────────────────────
function markViewed(itemId) {
    try {
        const key = 'viewedCards';
        const set = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
        set.add(itemId);
        localStorage.setItem(key, JSON.stringify([...set]));
    } catch (e) { /* ignore */ }
}

function isViewed(itemId) {
    try {
        return new Set(JSON.parse(localStorage.getItem('viewedCards') || '[]')).has(itemId);
    } catch (e) { return false; }
}

// ── Likes ─────────────────────────────────────────────────────────────────────
function toggleLike(event, itemId) {
    event.stopPropagation();
    const item = leaderboardData.find(d => d.id === itemId);
    if (!item) return;

    try {
        const likedKey = 'likedCards';
        const likedSet = new Set(JSON.parse(localStorage.getItem(likedKey) || '[]'));

        if (likedSet.has(itemId)) {
            item.likes = Math.max(0, (item.likes || 0) - 1);
            likedSet.delete(itemId);
        } else {
            item.likes = (item.likes || 0) + 1;
            likedSet.add(itemId);
        }

        localStorage.setItem(likedKey, JSON.stringify([...likedSet]));
        saveLocalData();

        const btn = event.currentTarget;
        btn.classList.toggle('liked', likedSet.has(itemId));
        btn.querySelector('.like-count').textContent = formatLikes(item.likes);
        btn.classList.add('like-pop');
        btn.addEventListener('animationend', () => btn.classList.remove('like-pop'), { once: true });
    } catch (e) { console.warn('Like error:', e); }
}

function isLiked(itemId) {
    try {
        return new Set(JSON.parse(localStorage.getItem('likedCards') || '[]')).has(itemId);
    } catch (e) { return false; }
}

function formatLikes(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n || 0);
}

// ── Sorting ───────────────────────────────────────────────────────────────────
function sortLeaderboard(sortBy) {
    currentSort = sortBy;
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === sortBy);
    });
    renderInstaCards();
}

function getSortedData(data) {
    const arr = [...data];
    if (currentSort === 'price') arr.sort((a, b) => (b.price || 0) - (a.price || 0));
    else if (currentSort === 'likes') arr.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    else if (currentSort === 'random') arr.sort(() => Math.random() - 0.5);
    return arr;
}

// ── Search ────────────────────────────────────────────────────────────────────
function onSearchInput() {
    searchQuery = (document.getElementById('search-input').value || '').trim().toLowerCase();
    updateSearchClearBtn();
    renderInstaCards();
}

function clearSearch() {
    const inp = document.getElementById('search-input');
    if (inp) inp.value = '';
    searchQuery = '';
    updateSearchClearBtn();
    renderInstaCards();
}

function updateSearchClearBtn() {
    const btn = document.getElementById('search-clear');
    if (btn) btn.style.display = searchQuery ? 'flex' : 'none';
}

function filterData(data) {
    if (!searchQuery) return data;
    return data.filter(item => {
        const q = searchQuery;
        return (
            (item.name || '').toLowerCase().includes(q) ||
            (item.message || '').toLowerCase().includes(q) ||
            String(item.price || '').includes(q)
        );
    });
}

// ── Read More ─────────────────────────────────────────────────────────────────
function collapseAllReadMore() {
    document.querySelectorAll('.card-motto-message.expanded, .yt-motto-message.expanded').forEach(el => {
        el.classList.remove('expanded');
        const btn = el.nextElementSibling;
        if (btn && btn.classList.contains('read-more-btn')) btn.textContent = 'more';
    });
}

function toggleReadMore(event, btnEl) {
    event.stopPropagation();
    const msgEl = btnEl.previousElementSibling;
    const willExpand = !msgEl.classList.contains('expanded');
    collapseAllReadMore();
    if (willExpand) {
        msgEl.classList.add('expanded');
        btnEl.textContent = 'less';
    }
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderInstaCards() {
    const grid = document.getElementById('insta-cards-grid');
    if (!grid) {
        console.error('Grid container "insta-cards-grid" not found');
        return;
    }

    try {
        const sorted = getSortedData(leaderboardData);
        const filtered = filterData(sorted);

        grid.innerHTML = filtered.length === 0
            ? `<div class="empty-state" style="grid-column: 1 / -1; width: 100%; text-align: center; margin: 40px 0;"><h3>${searchQuery ? '🔍 No results found' : 'No design cards yet'}</h3><p>${searchQuery ? 'Try checking your spelling or a different query.' : 'Tap "Create Card" to add one!'}</p></div>`
            : filtered.map(item => {
                try {
                    const isYT = isYouTubeVideoSafe(item.reelLink);
                    return isYT ? getYouTubeVideoCardHtml(item) : getReelThumbnailHtml(item);
                } catch (e) {
                    console.error('Error rendering card:', e);
                    return '';
                }
            }).join('');
    } catch (e) {
        console.error('renderInstaCards error:', e);
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; width: 100%; text-align: center; margin: 40px 0;"><h3>Something went wrong</h3><p>Please refresh the page and try again.</p></div>`;
    }
}

// ── URL helpers (safe versions) ───────────────────────────────────────────────
function cleanInstagramUrl(url) {
    if (!url || url === '#') return url || '#';
    try {
        const p = new URL(url);
        if (!p.hostname.includes('instagram.com')) return url;
        p.search = ''; p.hash = '';
        if (!p.pathname.endsWith('/')) p.pathname += '/';
        return p.toString();
    } catch { return url; }
}

function getYouTubeVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/);
    return (m && m[2] && m[2].length === 11) ? m[2] : null;
}

function isYouTubeShort(url) {
    if (!url || typeof url !== 'string') return false;
    return /youtube\.com\/shorts\//i.test(url) || /youtu\.be\//i.test(url);
}

function isYouTubeVideoSafe(url) {
    if (!url || typeof url !== 'string' || url === '#') return false;
    return getYouTubeVideoId(url) !== null && !isYouTubeShort(url);
}

function isDirectVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

// ── Modal player ──────────────────────────────────────────────────────────────
function openReelModal(reelUrl, itemId) {
    if (itemId !== undefined) {
        markViewed(itemId);
        const card = document.querySelector(`[data-item-id="${itemId}"]`);
        if (card) {
            card.classList.add('card-viewed');
            const infos = card.querySelectorAll('.card-info-section, .yt-info-section');
            infos.forEach(el => el.classList.add('info-viewed'));
        }
    }

    const modal = document.getElementById('reel-modal');
    const container = document.getElementById('reel-player-container');
    const mc = modal ? modal.querySelector('.reel-modal-content') : null;
    if (!modal || !container || !mc) return;

    container.innerHTML = '';
    mc.classList.remove('youtube-layout', 'instagram-layout');

    const youtubeId = getYouTubeVideoId(reelUrl);
    const isDirect = isDirectVideoUrl(reelUrl);

    if (isDirect) {
        mc.classList.add('youtube-layout');
        container.innerHTML = `<video src="${reelUrl}" autoplay controls loop playsinline style="width:100%;height:100%;border-radius:20px;">Your browser does not support video.</video>`;
        modal.classList.add('show');
    } else if (youtubeId) {
        mc.classList.add('youtube-layout');
        container.innerHTML = `<iframe src="https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&rel=0" class="youtube-video-player" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        modal.classList.add('show');
    } else {
        mc.classList.add('instagram-layout');
        const cleanedUrl = cleanInstagramUrl(reelUrl);
        container.innerHTML = `
            <div class="instagram-notice"><span>👆 Tap video once to play (Instagram safety rule)</span></div>
            <div class="reel-loader" id="reel-loader"><div class="spinner"></div><span>Loading Reel...</span></div>
            <blockquote class="instagram-media" data-instgrm-permalink="${cleanedUrl}" data-instgrm-version="14"
                style="background:#FFF;border:0;border-radius:12px;box-shadow:0 0 1px 0 rgba(0,0,0,.5),0 1px 10px 0 rgba(0,0,0,.15);margin:0;min-width:280px;width:100%;"></blockquote>`;
        modal.classList.add('show');

        const obs = new MutationObserver(() => {
            const iframe = container.querySelector('iframe');
            if (iframe) {
                iframe.onload = () => { const l = document.getElementById('reel-loader'); if (l) l.classList.add('hidden'); };
                setTimeout(() => { const l = document.getElementById('reel-loader'); if (l) l.classList.add('hidden'); }, 4000);
                obs.disconnect();
            }
        });
        obs.observe(container, { childList: true });

        if (!document.getElementById('instagram-embed-script')) {
            const s = document.createElement('script');
            s.id = 'instagram-embed-script'; s.async = true;
            s.src = 'https://www.instagram.com/embed.js';
            document.body.appendChild(s);
        } else if (window.instgrm) {
            window.instgrm.Embeds.process();
        }
    }
}

function closeReelModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('reel-modal');
    if (modal) {
        modal.classList.remove('show');
        const mc = modal.querySelector('.reel-modal-content');
        if (mc) mc.classList.remove('youtube-layout', 'instagram-layout');
    }
    const c = document.getElementById('reel-player-container');
    if (c) c.innerHTML = '';
}

// ── Insert form ───────────────────────────────────────────────────────────────
function openInsertModal() {
    document.getElementById('insert-modal').classList.add('show');
    document.getElementById('insert-form').reset();
}

function closeInsertModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('insert-modal').classList.remove('show');
}

function handleInsertSubmit(event) {
    event.preventDefault();
    const name = (document.getElementById('insert-name').value || '').trim();
    const profilePicture = (document.getElementById('insert-profile').value || '').trim();
    const coverImageEl = document.getElementById('insert-cover');
    const coverImage = coverImageEl ? (coverImageEl.value || '').trim() : '';
    const message = (document.getElementById('insert-message').value || '').trim();
    const reelLink = (document.getElementById('insert-reel').value || '').trim();
    const price = parseInt(document.getElementById('insert-price').value) || 0;

    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'A')}&background=random&size=200`;
    const resolvedProfile = profilePicture || fallbackAvatar;
    const newEntry = {
        id: Date.now(),
        name: name || 'Anonymous',
        profilePicture: resolvedProfile,
        coverImage: coverImage || resolvedProfile,
        message: message || 'No message provided',
        reelLink: reelLink || '#',
        price,
        likes: 0
    };

    leaderboardData.push(newEntry);
    saveLocalData();
    renderInstaCards();
    switchTab(isYouTubeVideoSafe(newEntry.reelLink) ? 'youtube' : 'reels');
    closeInsertModal({ target: document.getElementById('insert-modal'), currentTarget: document.getElementById('insert-modal') });
    showSuccessMessage('Card created! ✅');
}


// ── Flip card helper ──────────────────────────────────────────
function flipCard(event, innerEl) {
    event.stopPropagation();
    if (innerEl) innerEl.classList.toggle('flipped');
}

// YouTube VIDEO card — flip design image → YT thumbnail
function getYouTubeVideoCardHtml(item) {
    const youtubeId = getYouTubeVideoId(item.reelLink);
    if (!youtubeId) return '';
    const thumbUrl  = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    const encodedItem = safeEncode(item);
    const viewed    = isViewed(item.id);
    const viewedCls = viewed ? ' card-viewed' : '';
    const liked     = isLiked(item.id);
    const coverSrc  = item.coverImage || item.profilePicture || '';
    const innerId   = `fci-${item.id}`;
    const safeLink  = item.reelLink.replace(/'/g, "\'");
    const priceStr  = (item.price || 0).toLocaleString('en-IN');
    const likesStr  = formatLikes(item.likes || 0);

    const coverHTML = coverSrc
        ? `<img src="${coverSrc}" class="fc-img" alt="Design"
               onerror="this.parentElement.innerHTML='<div class=fc-img-placeholder></div>'">`
        : `<div class="fc-img-placeholder"></div>`;

    const likeBar = `
        <div class="fc-bar" onclick="event.stopPropagation()">
            <button class="fc-like${liked ? ' liked' : ''}"
                    onclick="toggleLike(event,${item.id})" aria-label="Like">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span class="like-count">${likesStr}</span>
            </button>
            <div class="fc-bar-right">
                ${viewed ? '<span class="fc-watched-badge">&#10003; Watched</span>' : ''}
                ${encodedItem ? `<button class="fc-share" onclick="copyCardLink(event,'${encodedItem}')" title="Copy link">🔗</button>` : ''}
            </div>
        </div>`;

    return `
    <div class="fc yt-fc${viewedCls}" data-item-id="${item.id}">
      <div class="fc-inner" id="${innerId}">

        <!-- FRONT: design/cover image (header, media area, and bar are separated) -->
        <div class="fc-front" onclick="flipCard(event, document.getElementById('${innerId}'))">
          <div class="fc-header">
            <span class="fc-header-badge yt-badge">&#9654; YouTube</span>
            <span class="fc-header-price">&#8377;${priceStr}</span>
          </div>
          <div class="fc-media-area">
            ${coverHTML}
            <div class="fc-tap-hint">Tap to flip &#8594;</div>
          </div>
          ${likeBar}
        </div>

        <!-- BACK: YouTube thumbnail -->
        <div class="fc-back" onclick="openReelModal('${safeLink}',${item.id})">
          <div class="fc-header">
            <span class="fc-header-badge yt-badge">&#9654; YouTube</span>
            <div class="fc-header-right">
              <span class="fc-header-price">&#8377;${priceStr}</span>
              <button class="fc-flip-back"
                      onclick="event.stopPropagation(); document.getElementById('${innerId}').classList.remove('flipped')"
                      title="Flip back">&#10005;</button>
            </div>
          </div>
          <div class="fc-media-area">
            <img src="${thumbUrl}" class="fc-yt-img" alt="YouTube thumbnail"
                 onerror="this.src='https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg'">
            <div class="fc-back-overlay"></div>
            <div class="fc-play-ring"><div class="fc-play-tri"></div></div>
            <div class="fc-back-label">&#9654; Watch Video</div>
          </div>
          ${likeBar}
        </div>

      </div>
    </div>`;
}





// Reel / Short card — click opens modal directly (no flip)
function getReelThumbnailHtml(item) {
    const youtubeId   = getYouTubeVideoId(item.reelLink);
    const encodedItem = safeEncode(item);
    const viewed      = isViewed(item.id);
    const viewedCls   = viewed ? ' card-viewed' : '';
    const liked       = isLiked(item.id);
    const coverSrc    = item.coverImage || item.profilePicture || '';
    const isYtShort   = !!youtubeId;
    const badgeCls    = isYtShort ? 'yt-badge' : 'ig-badge';
    const badgeTxt    = isYtShort ? '&#9654; Shorts' : '&#128248; Reel';
    const safeLink    = (item.reelLink || '#').replace(/'/g, "\'");
    const priceStr    = (item.price || 0).toLocaleString('en-IN');
    const likesStr = formatLikes(item.likes || 0);

    const coverHTML = coverSrc
        ? `<img src="${coverSrc}" class="fc-img" alt="Design"
               onerror="this.parentElement.innerHTML='<div class=fc-img-placeholder></div>'">`
        : `<div class="fc-img-placeholder"></div>`;

    const likeBar = `
        <div class="fc-bar" onclick="event.stopPropagation()">
            <button class="fc-like${liked ? ' liked' : ''}"
                    onclick="toggleLike(event,${item.id})" aria-label="Like">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span class="like-count">${likesStr}</span>
            </button>
            <div class="fc-bar-right">
                ${viewed ? '<span class="fc-watched-badge">&#10003; Watched</span>' : ''}
                ${encodedItem ? `<button class="fc-share" onclick="copyCardLink(event,'${encodedItem}')" title="Copy link">&#128279;</button>` : ''}
            </div>
        </div>`;

    return `
    <div class="fc reel-fc${viewedCls}" data-item-id="${item.id}"
         onclick="openReelModal('${safeLink}',${item.id})">
      <div class="fc-header">
        <span class="fc-header-badge ${badgeCls}">${badgeTxt}</span>
        <span class="fc-header-price">&#8377;${priceStr}</span>
      </div>
      <div class="fc-media-area">
        ${coverHTML}
        <div class="fc-reel-play"><div class="fc-reel-tri"></div></div>
      </div>
      ${likeBar}
    </div>`;
}





// ── Copy link ─────────────────────────────────────────────────────────────────
function copyCardLink(event, encodedItem) {
    event.stopPropagation();
    const url = window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, '/')) + 'card.html?data=' + encodedItem;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => showToast('Link copied! 🔗')).catch(() => fallbackCopy(url));
    } else { fallbackCopy(url); }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) { }
    document.body.removeChild(ta);
    showToast('Link copied! 🔗');
}

// ── Toast & messages ──────────────────────────────────────────────────────────
function showToast(msg) {
    let t = document.getElementById('copy-toast');
    if (!t) {
        t = document.createElement('div'); t.id = 'copy-toast';
        t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:linear-gradient(135deg,#833ab4,#dc2743);color:#fff;font-family:Roboto,sans-serif;font-size:.82rem;font-weight:700;padding:10px 20px;border-radius:100px;box-shadow:0 6px 20px rgba(220,39,67,.45);opacity:0;transition:all .3s cubic-bezier(.34,1.56,.64,1);z-index:9999;white-space:nowrap;pointer-events:none;';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2500);
}

function showSuccessMessage(message) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:16px;right:16px;background:linear-gradient(45deg,#f09433,#dc2743,#bc1888);color:white;padding:11px 20px;border-radius:10px;font-weight:700;font-size:.88rem;z-index:2000;animation:slideIn .3s ease;box-shadow:0 4px 14px rgba(220,39,67,.3);';
    d.textContent = message;
    document.body.appendChild(d);
    setTimeout(() => { d.style.animation = 'slideOut .3s ease'; setTimeout(() => d.remove(), 300); }, 3000);
}

// ── Instagram thumb fallback ──────────────────────────────────────────────────
function handleThumbError(imgElement) {
    const c = imgElement.closest('.instagram-thumb-container');
    if (c) { c.style.background = 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)'; imgElement.style.display = 'none'; }
}

// ── Keyframe styles ───────────────────────────────────────────────────────────
const _s = document.createElement('style');
_s.textContent = `
    @keyframes slideIn  { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes slideOut { from{transform:translateX(0);opacity:1} to{transform:translateX(100%);opacity:0} }
    @keyframes likePop  { 0%{transform:scale(1)} 40%{transform:scale(1.5)} 70%{transform:scale(.88)} 100%{transform:scale(1)} }
    .like-btn.like-pop, .fc-like.like-pop { animation:likePop .42s cubic-bezier(.36,.07,.19,.97) both; }
`;
document.head.appendChild(_s);

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
