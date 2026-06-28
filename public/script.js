// ========================================
// INSTA CARDS — JAVASCRIPT v7.0
// ========================================

const DATA_VERSION = 7; // bump to force-clear old localStorage

// ── Sample data ───────────────────────────────────────────────────────────────
const sampleData = [
    {
        id: 1,
        name: "Creative Artist",
        profilePicture: "assets/profiles/5000.jpg",
        message: "Creating amazing content daily! Follow for more inspiration and creative adventures across all platforms",
        reelLink: "https://www.instagram.com/reel/DZ4f05ATGsf/",
        price: 5000,
        likes: 0
    },
    {
        id: 2,
        name: "Tech Influencer",
        profilePicture: "assets/profiles/1000.jpg",
        message: "Latest tech reviews and tutorials and many more things as we go on and we will do our best to get anything so keep trying you have great future okay.",
        reelLink: "https://www.instagram.com/reel/DYK1M4tTxeS/?igsh=cmtpd3Q1cWRkMzc3",
        price: 3500,
        likes: 0
    },
    {
        id: 3,
        name: "Food Blogger",
        profilePicture: "assets/profiles/500.jpg",
        message: "Delicious recipes from around the world",
        reelLink: "https://www.instagram.com/reel/DWgxI5nic5P/?igsh=MTdhNmFvbHJwdmc1dw==",
        price: 2500,
        likes: 0
    },
    {
        id: 4,
        name: "Music Curator",
        profilePicture: "assets/profiles/200.jpg",
        message: "Listen to the top trending music hits of the week",
        reelLink: "https://www.youtube.com/watch?v=a18py61_F_w&list=RDa18py61_F_w&start_radio=1",
        price: 6500,
        likes: 0
    },
    {
        id: 5,
        name: "Shorts Creator",
        profilePicture: "assets/profiles/100.jpg",
        message: "Mind-bending daily coding animations",
        reelLink: "https://www.youtube.com/shorts/Ae-5-2yXOu4",
        price: 1500,
        likes: 0
    }
];

// ── State ─────────────────────────────────────────────────────────────────────
let leaderboardData = [];
let currentSort = 'price';
let currentTab = 'youtube';
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

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
    currentTab = tab;
    const ytBtn = document.getElementById('tab-youtube');
    const reelsBtn = document.getElementById('tab-reels');
    const ytSection = document.getElementById('youtube-section');
    const reelsSection = document.getElementById('reels-section');

    if (ytBtn) ytBtn.classList.toggle('active', tab === 'youtube');
    if (reelsBtn) reelsBtn.classList.toggle('active', tab === 'reels');
    if (ytSection) ytSection.classList.toggle('active-section', tab === 'youtube');
    if (reelsSection) reelsSection.classList.toggle('active-section', tab === 'reels');
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
    const reelsGrid = document.getElementById('insta-cards-grid');
    const ytGrid = document.getElementById('youtube-cards-grid');
    if (!reelsGrid || !ytGrid) {
        console.error('Grid containers not found in DOM');
        return;
    }

    try {
        const sorted = getSortedData(leaderboardData);
        const filtered = filterData(sorted);

        const ytVideos = filtered.filter(item => isYouTubeVideoSafe(item.reelLink));
        const reelsAndShorts = filtered.filter(item => !isYouTubeVideoSafe(item.reelLink));

        // Tab counts (from ALL data)
        const ytAll = leaderboardData.filter(item => isYouTubeVideoSafe(item.reelLink));
        const reelsAll = leaderboardData.filter(item => !isYouTubeVideoSafe(item.reelLink));
        const ytCountEl = document.getElementById('yt-count');
        const reelsCountEl = document.getElementById('reels-count');
        if (ytCountEl) ytCountEl.textContent = ytAll.length;
        if (reelsCountEl) reelsCountEl.textContent = reelsAll.length;

        // YouTube grid
        ytGrid.innerHTML = ytVideos.length === 0
            ? `<div class="empty-state" style="grid-column:1/-1;"><h3>${searchQuery ? '🔍 No results' : 'No YouTube videos yet'}</h3><p>${searchQuery ? 'Try a different search.' : 'Tap "Create Card" to add one!'}</p></div>`
            : ytVideos.map(item => { try { return getYouTubeVideoCardHtml(item); } catch (e) { console.error('YT card error', e); return ''; } }).join('');

        // Reels grid
        reelsGrid.innerHTML = reelsAndShorts.length === 0
            ? `<div class="empty-state" style="grid-column:1/-1;"><h3>${searchQuery ? '🔍 No results' : 'No reels yet'}</h3><p>${searchQuery ? 'Try a different search.' : 'Tap "Create Card" to add one!'}</p></div>`
            : reelsAndShorts.map(item => { try { return getReelThumbnailHtml(item); } catch (e) { console.error('Reel card error', e); return ''; } }).join('');

        // Hover video preview
        reelsGrid.querySelectorAll('.reel-thumbnail-card').forEach(card => {
            const video = card.querySelector('video');
            if (video) {
                card.addEventListener('mouseenter', () => video.play().catch(() => {}));
                card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
            }
        });
    } catch (e) {
        console.error('renderInstaCards error:', e);
        ytGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>Something went wrong</h3><p>Please refresh the page.</p></div>`;
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
    const message = (document.getElementById('insert-message').value || '').trim();
    const reelLink = (document.getElementById('insert-reel').value || '').trim();
    const price = parseInt(document.getElementById('insert-price').value) || 0;

    const newEntry = {
        id: Date.now(),
        name: name || 'Anonymous',
        profilePicture: profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'A')}&background=random&size=200`,
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

// ── Card HTML builders ────────────────────────────────────────────────────────
// Like bar with price on the right
function buildLikeBar(item) {
    const liked = isLiked(item.id);
    return `
        <div class="card-like-bar" onclick="event.stopPropagation()">
            <button class="like-btn${liked ? ' liked' : ''}" onclick="toggleLike(event,${item.id})" aria-label="Like">
                <svg class="heart-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span class="like-count">${formatLikes(item.likes || 0)}</span>
            </button>
            <div class="card-price-tag">
                <span class="price-rupee">&#8377;</span>
                <span class="price-value">${(item.price || 0).toLocaleString('en-IN')}</span>
            </div>
        </div>`;
}

function buildMessageBlock(msg, cssClass) {
    const safeMsg = (msg || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const isLong = (msg || '').length > 55;
    return `<div class="${cssClass}">&ldquo;${safeMsg}&rdquo;</div>${isLong ? `<button class="read-more-btn" onclick="toggleReadMore(event,this)">more</button>` : ''}`;
}

// YouTube VIDEO card
function getYouTubeVideoCardHtml(item) {
    const youtubeId = getYouTubeVideoId(item.reelLink);
    if (!youtubeId) return '';
    const thumbUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    const encodedItem = safeEncode(item);
    const viewed = isViewed(item.id);
    const viewedClass = viewed ? ' card-viewed' : '';
    const infoViewedClass = viewed ? ' info-viewed' : '';

    return `
        <div class="yt-video-card${viewedClass}" data-item-id="${item.id}" onclick="openReelModal('${item.reelLink.replace(/'/g, "\\'")}',${item.id})">
            <div class="yt-thumb-section">
                <img src="${thumbUrl}" alt="${(item.name||'').replace(/"/g,'')}" class="yt-thumb-img"
                     onerror="this.src='https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg'">
                <img src="${item.profilePicture||''}" class="yt-avatar" onerror="this.style.display='none'" alt="">
                ${encodedItem ? `<button class="platform-badge youtube-badge" title="Copy link" onclick="copyCardLink(event,'${encodedItem}')">&#128308;</button>` : ''}
                <div class="play-icon yt-play-icon">&#9654;</div>
                ${viewed ? '<div class="viewed-badge">&#10003; Watched</div>' : ''}
            </div>
            <div class="yt-info-section${infoViewedClass}">
                <div class="yt-creator-name">@${item.name||'Unknown'}</div>
                ${buildMessageBlock(item.message, 'card-motto-message')}
            </div>
            ${buildLikeBar(item)}
        </div>`;
}

// Reel / Short card
function getReelThumbnailHtml(item) {
    const youtubeId = getYouTubeVideoId(item.reelLink);
    const isDirect = isDirectVideoUrl(item.reelLink);
    const viewed = isViewed(item.id);
    const encodedItem = safeEncode(item);
    const viewedClass = viewed ? ' card-viewed' : '';
    const infoViewedClass = viewed ? ' info-viewed' : '';

    let mediaContent = '';
    if (youtubeId) {
        mediaContent = `<img src="https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg" alt="" class="reel-thumbnail-img">`;
    } else if (isDirect) {
        mediaContent = `<video src="${item.reelLink}" class="reel-thumbnail-img" muted preload="metadata" playsinline></video>`;
    } else {
        const cleanedUrl = cleanInstagramUrl(item.reelLink);
        const instgrmThumb = cleanedUrl.replace('/reel/', '/p/') + 'media/?size=m';
        mediaContent = `<div class="instagram-thumb-container" style="width:100%;height:100%;"><img src="${instgrmThumb}" class="reel-thumbnail-img" alt="" referrerpolicy="no-referrer" onerror="handleThumbError(this)"></div>`;
    }

    const badgeHtml = encodedItem ? (youtubeId
        ? `<button class="platform-badge youtube-badge" title="Copy link" onclick="copyCardLink(event,'${encodedItem}')">&#128308;</button>`
        : `<button class="platform-badge instagram-badge" title="Copy link" onclick="copyCardLink(event,'${encodedItem}')">&#128248;</button>`)
        : '';

    return `
        <div class="reel-thumbnail-card${viewedClass}" data-item-id="${item.id}" onclick="openReelModal('${(item.reelLink||'#').replace(/'/g, "\\'")}',${item.id})">
            <div class="card-photo-section">
                <img src="${item.profilePicture||''}" class="card-cover-photo" onerror="this.style.display='none'">
                ${badgeHtml}
                <div class="play-icon">&#9654;</div>
                ${viewed ? '<div class="viewed-badge">&#10003; Watched</div>' : ''}
            </div>
            <div class="card-info-section${infoViewedClass}">
                <div class="card-creator-name">@${item.name||'Unknown'}</div>
                ${buildMessageBlock(item.message, 'card-motto-message')}
            </div>
            ${buildLikeBar(item)}
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
    try { document.execCommand('copy'); } catch (_) {}
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
    .like-btn.like-pop { animation:likePop .42s cubic-bezier(.36,.07,.19,.97) both; }
`;
document.head.appendChild(_s);

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
