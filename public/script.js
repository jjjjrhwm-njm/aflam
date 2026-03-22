const App = {
    state: {
        data: [],
        favorites: [],
        currentFilter: 'all',
        userId: localStorage.getItem('userId') || `user_${Date.now()}`,
        player: null
    },
    elements: {
        grid: document.getElementById('moviesGrid'),
        skeleton: document.getElementById('skeleton'),
        heroBg: document.getElementById('heroBg'),
        heroTitle: document.getElementById('heroTitle'),
        heroYear: document.getElementById('heroYear'),
        heroRating: document.getElementById('heroRating'),
        heroDuration: document.getElementById('heroDuration'),
        heroDesc: document.getElementById('heroDesc'),
        heroPlayBtn: document.getElementById('heroPlayBtn'),
        heroFavBtn: document.getElementById('heroFavBtn'),
        searchInput: document.getElementById('searchInput'),
        playerModal: document.getElementById('playerModal'),
        playerVideo: document.getElementById('playerVideo'),
        closePlayerBtn: document.getElementById('closePlayerBtn'),
        toast: document.getElementById('toast')
    },
    init: async () => {
        if (!localStorage.getItem('userId')) localStorage.setItem('userId', App.state.userId);
        App.setupEventListeners();
        await App.loadFavorites();
        await App.fetchContent();
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
                App.state.currentFilter = filter;
                document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (filter === 'favorites') App.renderFavorites();
                else App.filterContent();
                document.getElementById('mobileMenu')?.classList.remove('active');
            });
        });
        // Search
        let searchTimeout;
        App.elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => App.filterContent(e.target.value), 300);
        });
        // Hero buttons
        App.elements.heroPlayBtn.addEventListener('click', () => {
            if (App.state.heroItem) App.playVideo(App.state.heroItem.link, App.state.heroItem.titleAr);
        });
        App.elements.heroFavBtn.addEventListener('click', () => {
            if (App.state.heroItem) App.toggleFavorite(App.state.heroItem);
        });
        // Player
        App.elements.closePlayerBtn.addEventListener('click', App.closePlayer);
        // Mobile menu
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
            document.getElementById('mobileMenu').classList.add('active');
        });
        document.getElementById('closeMobileMenu')?.addEventListener('click', () => {
            document.getElementById('mobileMenu').classList.remove('active');
        });
        // Scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.getElementById('navbar');
            if (window.scrollY > 50) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');
        });
    },
    fetchContent: async () => {
        try {
            const res = await fetch('/api/content');
            const result = await res.json();
            if (result.status === 'success') {
                App.state.data = result.data;
                App.renderHero();
                App.renderGrid(App.state.data);
            }
        } catch (error) {
            console.error(error);
        }
    },
    filterContent: (search = '') => {
        let filtered = App.state.data;
        if (App.state.currentFilter !== 'all') {
            filtered = filtered.filter(item => item.category === App.state.currentFilter);
        }
        if (search) {
            filtered = filtered.filter(item => item.titleAr.includes(search) || item.genre.includes(search));
        }
        App.renderGrid(filtered);
    },
    renderHero: () => {
        if (App.state.data.length === 0) return;
        const hero = App.state.data[0];
        App.state.heroItem = hero;
        const imgUrl = `/api/image/${hero.poster}`;
        App.elements.heroBg.style.backgroundImage = `url('${imgUrl}')`;
        App.elements.heroTitle.textContent = hero.titleAr;
        App.elements.heroYear.textContent = hero.year;
        App.elements.heroRating.querySelector('span').textContent = hero.rating || '4.5';
        App.elements.heroDuration.textContent = hero.duration || '120 دقيقة';
        App.elements.heroDesc.textContent = hero.description || 'لا يوجد وصف';
        const isFav = App.state.favorites.some(f => f._id === hero._id);
        App.elements.heroFavBtn.innerHTML = isFav ? '<i class="fa-solid fa-heart"></i> في قائمتي' : '<i class="fa-regular fa-heart"></i> قائمتي';
    },
    renderGrid: (items) => {
        App.elements.skeleton.style.display = 'none';
        App.elements.grid.style.display = 'grid';
        if (items.length === 0) {
            document.getElementById('noResults').style.display = 'block';
            App.elements.grid.style.display = 'none';
            return;
        }
        document.getElementById('noResults').style.display = 'none';
        App.elements.grid.innerHTML = items.map(item => `
            <div class="movie-card" data-id="${item._id}">
                <img src="/api/image/${item.poster}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x450?text=No+Image'">
                <div class="movie-info">
                    <h3>${item.titleAr}</h3>
                    <div class="movie-meta">
                        <span>${item.year}</span>
                        <span>${item.genre}</span>
                    </div>
                </div>
            </div>
        `).join('');
        document.querySelectorAll('.movie-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const item = App.state.data.find(i => i._id === id);
                if (item) App.openDetails(item);
            });
        });
    },
    renderFavorites: () => {
        const favs = App.state.favorites;
        App.renderGrid(favs);
    },
    openDetails: (item) => {
        App.state.heroItem = item;
        const imgUrl = `/api/image/${item.poster}`;
        App.elements.heroBg.style.backgroundImage = `url('${imgUrl}')`;
        App.elements.heroTitle.textContent = item.titleAr;
        App.elements.heroYear.textContent = item.year;
        App.elements.heroRating.querySelector('span').textContent = item.rating || '4.5';
        App.elements.heroDuration.textContent = item.duration || '120 دقيقة';
        App.elements.heroDesc.textContent = item.description || 'لا يوجد وصف';
        const isFav = App.state.favorites.some(f => f._id === item._id);
        App.elements.heroFavBtn.innerHTML = isFav ? '<i class="fa-solid fa-heart"></i> في قائمتي' : '<i class="fa-regular fa-heart"></i> قائمتي';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    toggleFavorite: async (item) => {
        const isFav = App.state.favorites.some(f => f._id === item._id);
        const action = isFav ? 'remove' : 'add';
        try {
            const res = await fetch(`/api/user/${App.state.userId}/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentId: item._id, action })
            });
            if (res.ok) {
                if (action === 'add') App.state.favorites.push(item);
                else App.state.favorites = App.state.favorites.filter(f => f._id !== item._id);
                App.showToast(action === 'add' ? 'تمت الإضافة' : 'تمت الإزالة');
                if (App.state.heroItem?._id === item._id) {
                    const btn = App.elements.heroFavBtn;
                    btn.innerHTML = action === 'add' ? '<i class="fa-solid fa-heart"></i> في قائمتي' : '<i class="fa-regular fa-heart"></i> قائمتي';
                }
                if (App.state.currentFilter === 'favorites') App.renderFavorites();
            }
        } catch (error) { console.error(error); }
    },
    playVideo: (url, title) => {
        App.elements.playerModal.style.display = 'flex';
        const video = App.elements.playerVideo;
        if (App.player) App.player.destroy();
        if (url.includes('m3u8') && Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            App.player = new Plyr(video);
        } else if (url.includes('youtube') || url.includes('youtu.be')) {
            App.player = new Plyr(video);
            App.player.source = { type: 'video', sources: [{ src: url, provider: 'youtube' }] };
        } else {
            video.src = url;
            App.player = new Plyr(video);
        }
        App.player.play();
    },
    closePlayer: () => {
        App.elements.playerModal.style.display = 'none';
        if (App.player) {
            App.player.stop();
            App.player.destroy();
            App.player = null;
        }
        App.elements.playerVideo.src = '';
    },
    loadFavorites: async () => {
        try {
            const res = await fetch(`/api/user/${App.state.userId}/favorites`);
            const result = await res.json();
            if (result.status === 'success') App.state.favorites = result.data;
        } catch (error) { console.error(error); }
    },
    showToast: (msg) => {
        const toast = App.elements.toast;
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
};

App.init();
