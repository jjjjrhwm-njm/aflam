const App = {
    data: [],
    favorites: [],
    currentFilter: 'all',
    currentGenre: 'all',
    searchQuery: '',
    userId: localStorage.getItem('userId') || null,
    token: localStorage.getItem('token'),
    user: null,

    init: async () => {
        if (!App.token) {
            window.location.href = '/login';
            return;
        }
        // التحقق من صلاحية المستخدم
        try {
            const userStr = localStorage.getItem('user');
            App.user = userStr ? JSON.parse(userStr) : null;
            if (!App.user || !App.user.isVIP) {
                alert('هذه الصفحة مخصصة للأعضاء VIP فقط');
                window.location.href = '/';
                return;
            }
        } catch(e) {
            window.location.href = '/login';
        }

        App.setupEventListeners();
        await App.loadFavorites();
        await App.fetchVIPContent();
        setTimeout(() => {
            const loading = document.getElementById('loadingOverlay');
            loading.style.opacity = '0';
            setTimeout(() => loading.style.display = 'none', 500);
        }, 800);
    },

    setupEventListeners: () => {
        // Navigation
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                if (filter === 'favorites') {
                    App.currentFilter = 'favorites';
                    App.renderFavorites();
                } else if (filter === 'all' || filter === 'movie' || filter === 'series') {
                    App.currentFilter = filter;
                    App.currentGenre = 'all';
                    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
                    document.querySelector('.cat-tab[data-genre="all"]').classList.add('active');
                    App.filterContent();
                } else {
                    // في حالة الضغط على زر VIP من داخل VIP (نحن فيها)
                    return;
                }
                document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('mobileMenu')?.classList.remove('active');
            });
        });

        // Search
        let searchTimeout;
        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                App.searchQuery = e.target.value;
                App.filterContent();
            }, 300);
        });

        // Category tabs
        document.querySelectorAll('.cat-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const genre = tab.dataset.genre;
                App.currentGenre = genre;
                document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                App.filterContent();
            });
        });

        // User menu
        const userBtn = document.getElementById('userMenuBtn');
        if (userBtn) {
            userBtn.addEventListener('click', () => {
                if (confirm('تسجيل الخروج؟')) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/';
                }
            });
        }

        // Mobile menu
        const menuBtn = document.getElementById('mobileMenuBtn');
        const closeMenu = document.getElementById('closeMobileMenu');
        const mobileMenu = document.getElementById('mobileMenu');
        if (menuBtn) menuBtn.onclick = () => mobileMenu.classList.add('active');
        if (closeMenu) closeMenu.onclick = () => mobileMenu.classList.remove('active');

        // Scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.getElementById('navbar');
            if (window.scrollY > 50) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');
        });
    },

    fetchVIPContent: async () => {
        try {
            const res = await fetch('/api/content/vip', {
                headers: { 'Authorization': `Bearer ${App.token}` }
            });
            const result = await res.json();
            if (result.success) {
                App.data = result.data;
                App.renderSliders();
            } else if (result.message === 'VIP subscription required') {
                alert('يجب أن تكون مشترك VIP للوصول إلى هذا المحتوى');
                window.location.href = '/';
            } else {
                console.error(result);
            }
        } catch (err) {
            console.error(err);
        }
    },

    filterContent: () => {
        let filtered = App.data;
        if (App.currentFilter !== 'all') {
            filtered = filtered.filter(item => item.category === App.currentFilter);
        }
        if (App.currentGenre !== 'all') {
            filtered = filtered.filter(item => item.genre === App.currentGenre);
        }
        if (App.searchQuery) {
            filtered = filtered.filter(item => item.title.includes(App.searchQuery));
        }
        App.renderSliders(filtered);
    },

    renderSliders: (items = null) => {
        const data = items || App.data;
        const grid = document.getElementById('moviesGrid');
        const skeleton = document.getElementById('skeletonLoader');
        const empty = document.getElementById('noResults');

        skeleton.style.display = 'none';
        if (data.length === 0) {
            grid.style.display = 'none';
            empty.style.display = 'block';
            return;
        }
        grid.style.display = 'block';
        empty.style.display = 'none';

        // Group by genre
        const grouped = {};
        data.forEach(item => {
            const genre = item.genre || 'أخرى';
            if (!grouped[genre]) grouped[genre] = [];
            grouped[genre].push(item);
        });

        grid.innerHTML = '';
        Object.keys(grouped).forEach(genre => {
            const items = grouped[genre];
            const sliderId = `slider-${genre}-${Date.now()}`;
            const section = document.createElement('div');
            section.className = 'genre-slider-section';
            section.innerHTML = `
                <div class="slider-header">
                    <div class="slider-title-wrapper">
                        <div class="genre-icon"><i class="${App.getGenreIcon(genre)}"></i></div>
                        <h2 class="slider-title">${genre} VIP</h2>
                    </div>
                    <div class="slider-controls">
                        <button class="slider-nav-btn slider-nav-prev" data-slider="${sliderId}"><i class="fa-solid fa-chevron-right"></i></button>
                        <button class="slider-nav-btn slider-nav-next" data-slider="${sliderId}"><i class="fa-solid fa-chevron-left"></i></button>
                    </div>
                </div>
                <div class="slider-container" id="${sliderId}">
                    <div class="slider-track">
                        ${items.map(item => App.createMovieCardHTML(item)).join('')}
                    </div>
                </div>
            `;
            grid.appendChild(section);
        });

        // Attach events
        document.querySelectorAll('.movie-card-slider').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = card.dataset.id;
                const item = App.data.find(i => i._id === itemId);
                if (item) App.openDetails(item);
            });
        });
        document.querySelectorAll('.slider-container').forEach(container => {
            App.addScrollShadowEffect(container);
            container.addEventListener('scroll', () => App.addScrollShadowEffect(container));
        });
        document.querySelectorAll('.slider-nav-prev, .slider-nav-next').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sliderId = btn.dataset.slider;
                const slider = document.getElementById(sliderId);
                if (!slider) return;
                const delta = btn.classList.contains('slider-nav-prev') ? -320 : 320;
                slider.scrollBy({ left: delta, behavior: 'smooth' });
            });
        });
    },

    createMovieCardHTML: (item) => {
        const imgUrl = `/api/image/${item.poster}`;
        const title = item.title;
        const isFav = App.favorites.some(f => f._id === item._id);
        return `
            <div class="movie-card-slider" data-id="${item._id}">
                <div class="movie-card-inner">
                    <img src="${imgUrl}" loading="lazy" alt="${title}" onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=500&auto=format&fit=crop'">
                    <div class="movie-card-overlay">
                        <button class="play-btn-overlay" onclick="event.stopPropagation(); App.playVideo('${item.link.replace(/'/g, "\\'")}', '${title.replace(/'/g, "\\'")}')"><i class="fa-solid fa-play"></i></button>
                        <button class="fav-btn-overlay ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); App.toggleFavorite('${item._id}')"><i class="fa-solid ${isFav ? 'fa-heart' : 'fa-plus'}"></i></button>
                        <div class="movie-info-overlay"><h4>${title.length > 25 ? title.substring(0,25)+'...' : title}</h4><div class="movie-meta"><span>${item.year || '2024'}</span><span class="dot">•</span><span>VIP</span></div></div>
                    </div>
                </div>
            </div>
        `;
    },

    addScrollShadowEffect: (container) => {
        const scrollLeft = container.scrollLeft;
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (scrollLeft <= 5) container.classList.remove('scrolled-left');
        else container.classList.add('scrolled-left');
        if (scrollLeft >= maxScroll - 5) container.classList.remove('scrolled-right');
        else container.classList.add('scrolled-right');
    },

    getGenreIcon: (genre) => {
        const icons = {
            'أكشن': 'fa-solid fa-fist-raised',
            'دراما': 'fa-solid fa-mask',
            'كوميديا': 'fa-solid fa-face-laugh',
            'رعب': 'fa-solid fa-ghost',
            'خيال علمي': 'fa-solid fa-rocket',
            'مغامرات': 'fa-solid fa-mountain',
            'فنتازيا': 'fa-solid fa-dragon',
            'جريمة': 'fa-solid fa-handcuffs',
            'رومانسي': 'fa-solid fa-heart',
            'أنمي': 'fa-solid fa-dragon',
            'وثائقي': 'fa-solid fa-film',
            'تاريخي': 'fa-solid fa-landmark',
            'عائلي': 'fa-solid fa-family',
            'رياضة': 'fa-solid fa-futbol',
            'أخرى': 'fa-solid fa-tv'
        };
        return icons[genre] || 'fa-solid fa-clapperboard';
    },

    openDetails: (item) => {
        const isFav = App.favorites.some(f => f._id === item._id);
        document.getElementById('detailsImg').src = `/api/image/${item.poster}`;
        document.getElementById('detailsTitle').innerText = item.title;
        document.getElementById('detailsYear').innerHTML = `<i class="fa-regular fa-calendar"></i> ${item.year || '2024'}`;
        document.getElementById('detailsRating').innerText = item.rating || '4.5';
        document.getElementById('detailsViews').innerHTML = `<i class="fa-regular fa-eye"></i> ${item.views || 0} مشاهدة`;
        document.getElementById('detailsDescription').innerText = item.description || 'لا يوجد وصف متاح';
        document.getElementById('detailsQuality').innerHTML = `<i class="fa-solid fa-circle-check"></i> VIP HD`;
        const favBtn = document.getElementById('detailsFavBtn');
        favBtn.innerHTML = isFav ? '<i class="fa-solid fa-check"></i><span>في قائمتي</span>' : '<i class="fa-regular fa-heart"></i><span>أضف لقائمتي</span>';
        favBtn.onclick = () => App.toggleFavorite(item._id);
        document.getElementById('detailsPlayBtn').onclick = () => {
            App.closeDetails();
            App.playVideo(item.link, item.title);
        };
        document.getElementById('detailsModal').classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    closeDetails: () => {
        document.getElementById('detailsModal').classList.remove('show');
        document.body.style.overflow = 'auto';
    },

    toggleFavorite: async (contentId) => {
        const isFav = App.favorites.some(f => f._id === contentId);
        const action = isFav ? 'remove' : 'add';
        try {
            const res = await fetch('/api/user/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${App.token}`
                },
                body: JSON.stringify({ contentId, action })
            });
            if (res.ok) {
                if (action === 'add') {
                    const item = App.data.find(i => i._id === contentId);
                    if (item) App.favorites.push(item);
                    App.showToast('تمت الإضافة إلى قائمتي');
                } else {
                    App.favorites = App.favorites.filter(f => f._id !== contentId);
                    App.showToast('تمت الإزالة من قائمتي');
                }
                // تحديث الواجهة
                App.renderSliders();
                if (App.currentFilter === 'favorites') App.renderFavorites();
            }
        } catch (err) {
            console.error(err);
        }
    },

    renderFavorites: () => {
        const favs = App.favorites;
        App.renderSliders(favs);
    },

    playVideo: (url, title) => {
        const modal = document.getElementById('playerModal');
        const videoDiv = document.createElement('video');
        videoDiv.id = 'plyr-video';
        videoDiv.className = 'plyr-video-player';
        videoDiv.controls = true;
        videoDiv.setAttribute('playsinline', '');
        document.querySelector('.video-container').innerHTML = '';
        document.querySelector('.video-container').appendChild(videoDiv);
        modal.style.display = 'flex';
        document.getElementById('playerTitle').innerText = title;

        const ytId = App.extractYTId(url);
        const isM3U8 = url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('.m3u');
        const playerConfig = {
            controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'],
            autoplay: true,
            keyboard: { focused: true, global: true },
            tooltips: { controls: true, seek: true },
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] }
        };
        let player;
        if (ytId) {
            playerConfig.youtube = { noCookie: false, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1, origin: window.location.origin };
            player = new Plyr(videoDiv, playerConfig);
            player.source = { type: 'video', sources: [{ src: ytId, provider: 'youtube' }] };
        } else {
            player = new Plyr(videoDiv, playerConfig);
            if (isM3U8 && Hls.isSupported()) {
                const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
                hls.loadSource(url);
                hls.attachMedia(videoDiv);
                player.hls = hls;
                player.on('ready', () => player.play());
            } else {
                videoDiv.src = url;
                player.on('ready', () => player.play());
            }
        }
        window.currentPlayer = player;
    },

    closePlayer: () => {
        const modal = document.getElementById('playerModal');
        modal.style.display = 'none';
        if (window.currentPlayer) {
            if (window.currentPlayer.hls) window.currentPlayer.hls.destroy();
            window.currentPlayer.destroy();
            window.currentPlayer = null;
        }
        document.querySelector('.video-container').innerHTML = '';
    },

    extractYTId: (url) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    loadFavorites: async () => {
        try {
            const res = await fetch('/api/user/favorites', {
                headers: { 'Authorization': `Bearer ${App.token}` }
            });
            const result = await res.json();
            if (result.success) App.favorites = result.data;
        } catch (err) {
            console.error(err);
        }
    },

    showToast: (msg) => {
        const toast = document.getElementById('toastNotification');
        toast.querySelector('span').textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
