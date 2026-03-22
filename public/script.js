/**
 * 🚀 StreamFlix - Professional Video Streaming Platform
 * 🎬 Universal Player: Supports YouTube & Direct MP4 & M3U8 Links (V5.1 - Categorized)
 */

const App = {
    state: {
        data: [],
        favorites: JSON.parse(localStorage.getItem('streamflix_favorites')) || [],
        currentCategory: 'all',
        currentSearchQuery: '',
        isLoading: false,
        currentVideoLink: null
    },

    elements: {
        grid: document.getElementById('moviesGrid'),
        skeleton: document.getElementById('skeletonLoader'),
        noResults: document.getElementById('noResults'),
        navbar: document.getElementById('navbar'),
        heroBanner: document.getElementById('heroBanner'),
        heroTitle: document.getElementById('heroTitle'),
        heroDescription: document.getElementById('heroDescription'),
        heroPlayBtn: document.getElementById('heroPlayBtn'),
        heroInfoBtn: document.getElementById('heroInfoBtn'),
        detailsModal: document.getElementById('detailsModal'),
        detailsImg: document.getElementById('detailsImg'),
        detailsTitle: document.getElementById('detailsTitle'),
        detailsCategory: document.getElementById('detailsCategory'),
        detailsPlayBtn: document.getElementById('detailsPlayBtn'),
        detailsFavBtn: document.getElementById('detailsFavBtn'),
        closeDetailsBtn: document.getElementById('closeDetailsBtn'),
        detailsPlayOverlay: document.getElementById('detailsPlayOverlay'),
        playerModal: document.getElementById('playerModal'),
        playerTitle: document.getElementById('playerTitle'),
        closePlayerBtn: document.getElementById('closePlayerBtn'),
        videoContainer: document.querySelector('.video-container'),
        searchInput: document.getElementById('searchInput'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        mobileMenu: document.getElementById('mobileMenu'),
        toast: document.getElementById('toastNotification')
    },

    playerInstance: null,

    init: async () => {
        App.setupEventListeners();
        App.setupScrollEffect();
        await App.fetchData();
    },

    setupEventListeners: () => {
        App.elements.closeDetailsBtn?.addEventListener('click', () => App.closeDetails());
        App.elements.closePlayerBtn?.addEventListener('click', () => App.closePlayer());
        
        App.elements.detailsModal?.addEventListener('click', (e) => {
            if (e.target === App.elements.detailsModal) App.closeDetails();
        });
        
        App.elements.detailsPlayOverlay?.addEventListener('click', () => {
            const currentItem = App.state.currentItem;
            if (currentItem) {
                App.closeDetails();
                App.playVideo(currentItem.link, currentItem.title);
            }
        });
        
        App.elements.mobileMenuBtn?.addEventListener('click', () => {
            App.elements.mobileMenu?.classList.toggle('active');
        });
        
        document.addEventListener('click', (e) => {
            if (App.elements.mobileMenu?.classList.contains('active') &&
                !App.elements.mobileMenu.contains(e.target) &&
                !App.elements.mobileMenuBtn.contains(e.target)) {
                App.elements.mobileMenu.classList.remove('active');
            }
        });
        
        let searchTimeout;
        App.elements.searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                App.handleSearch(e.target.value);
            }, 300);
        });
        
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                if (filter === 'favorites') {
                    App.showFavorites(btn);
                } else if (filter) {
                    App.filterContent(filter, btn);
                }
                App.elements.mobileMenu?.classList.remove('active');
            });
        });
    },

    createPlayerContainer: () => {
        if (!App.elements.videoContainer) return null;
        App.elements.videoContainer.innerHTML = '';
        const videoDiv = document.createElement('video'); 
        videoDiv.id = 'plyr-video';
        videoDiv.className = 'plyr-video-player';
        videoDiv.controls = true;
        videoDiv.setAttribute('playsinline', '');
        App.elements.videoContainer.appendChild(videoDiv);
        return videoDiv;
    },

    fetchData: async () => {
        try {
            App.state.isLoading = true;
            const res = await fetch('/api/content');
            const result = await res.json();
            App.state.data = result.data || [];
            
            // إخفاء التحميل وإظهار الشبكة
            if (App.elements.skeleton) App.elements.skeleton.style.display = 'none';
            if (App.elements.grid) App.elements.grid.style.display = 'block'; // تحويل لـ block لدعم الأقسام
            
            if (App.state.data.length > 0) {
                App.renderHero(App.state.data[0]); // تشغيل البانر العلوي لأول فيلم
                App.renderGrid(App.state.data);
            } else {
                App.showEmptyState();
            }
        } catch (error) {
            if (App.elements.skeleton) {
                App.elements.skeleton.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>فشل الاتصال</h3></div>`;
            }
        } finally {
            App.state.isLoading = false;
        }
    },

    extractYTId: (url) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    // 🌟 جلب الصورة (يدعم البوستر المرفوع أو صورة يوتيوب)
    getThumbnail: (item) => {
        if (item && item.poster) {
            return `/api/image/${item.poster}`; // الصورة المرفوعة من تليجرام
        }
        const url = typeof item === 'string' ? item : (item ? item.link : '');
        const ytId = App.extractYTId(url);
        if (ytId) {
            return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        }
        return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1000&auto=format&fit=crop'; 
    },

    renderHero: (item) => {
        const imgUrl = App.getThumbnail(item);
        if (App.elements.heroBanner) App.elements.heroBanner.style.backgroundImage = `url('${imgUrl}')`;
        if (App.elements.heroTitle) App.elements.heroTitle.innerText = item.title;
        if (App.elements.heroPlayBtn) App.elements.heroPlayBtn.onclick = () => App.playVideo(item.link, item.title);
        if (App.elements.heroInfoBtn) App.elements.heroInfoBtn.onclick = () => App.openDetails(item);
        App.state.currentHeroItem = item;
    },

    // 🌟 التعديل الجديد: عرض الأفلام كأقسام مفصولة (أكشن، دراما..)
    renderGrid: (items) => {
        if (!App.elements.grid) return;
        App.elements.grid.innerHTML = '';
        if (items.length === 0) return App.showEmptyState();
        
        if (App.elements.noResults) App.elements.noResults.style.display = 'none';
        if (App.elements.grid) App.elements.grid.style.display = 'block';

        // تجميع الأفلام حسب التصنيف
        const grouped = items.reduce((acc, item) => {
            const g = item.genre || 'أخرى';
            if (!acc[g]) acc[g] = [];
            acc[g].push(item);
            return acc;
        }, {});

        // رسم كل قسم
        for (const [genre, genreItems] of Object.entries(grouped)) {
            const section = document.createElement('div');
            section.className = 'genre-section';
            section.style.marginBottom = '40px';
            
            section.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 0 10px;">
                    <h2 style="color: #fff; font-size: 1.2rem; border-right: 4px solid #e50914; padding-right: 10px; margin: 0;">${genre}</h2>
                </div>
                <div class="genre-row" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; padding: 0 10px;"></div>
            `;
            
            const row = section.querySelector('.genre-row');
            
            genreItems.forEach(item => {
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.onclick = () => App.openDetails(item);

                card.innerHTML = `
                    <img src="${App.getThumbnail(item)}" loading="lazy" alt="${item.title}" onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=500&auto=format&fit=crop'">
                    <div class="card-overlay">
                        <div class="play-icon-circle"><i class="fa-solid fa-play"></i></div>
                        <h3>${App.truncateText(item.title, 30)}</h3>
                    </div>
                `;
                row.appendChild(card);
            });
            
            App.elements.grid.appendChild(section);
        }
    },

    truncateText: (text, maxLength) => {
        return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
    },

    openDetails: (item) => {
        const isFav = App.state.favorites.some(f => f._id === item._id);
        if (App.elements.detailsImg) App.elements.detailsImg.src = App.getThumbnail(item);
        if (App.elements.detailsTitle) App.elements.detailsTitle.innerText = item.title;
        
        if (App.elements.detailsFavBtn) {
            App.elements.detailsFavBtn.innerHTML = isFav ? '<i class="fa-solid fa-check"></i><span>في قائمتي</span>' : '<i class="fa-solid fa-plus"></i><span>أضف لقائمتي</span>';
            App.elements.detailsFavBtn.onclick = () => App.toggleFavorite(item);
        }
        
        if (App.elements.detailsPlayBtn) {
            App.elements.detailsPlayBtn.onclick = () => {
                App.closeDetails();
                App.playVideo(item.link, item.title);
            };
        }
        
        App.state.currentItem = item;
        App.elements.detailsModal?.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    closeDetails: () => {
        App.elements.detailsModal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        App.state.currentItem = null;
    },

    toggleFavorite: (item) => {
        const index = App.state.favorites.findIndex(f => f._id === item._id);
        let message = index > -1 ? 'تمت إزالة من قائمتي' : 'تمت الإضافة إلى قائمتي';
        
        if (index > -1) App.state.favorites.splice(index, 1);
        else App.state.favorites.push(item);
            
        localStorage.setItem('streamflix_favorites', JSON.stringify(App.state.favorites));
        App.showToast(message, index === -1);
        App.openDetails(item); 
        if (App.state.currentCategory === 'favorites') App.renderGrid(App.state.favorites);
    },

    showToast: (message, isSuccess = true) => {
        const toast = App.elements.toast;
        if (!toast) return;
        const icon = toast.querySelector('i');
        const span = toast.querySelector('span');
        if (icon) icon.className = isSuccess ? 'fa-solid fa-check-circle' : 'fa-solid fa-trash-alt';
        if (span) span.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    // 🌟 مشغل الفيديو (يدعم M3U8, MP4, ويوتيوب)
    playVideo: (url, title) => {
        App.state.currentVideoLink = url;
        document.body.style.overflow = 'hidden';
        if (App.elements.playerTitle) App.elements.playerTitle.innerText = title;
        if (App.elements.playerModal) App.elements.playerModal.style.display = 'flex';
        
        const videoElement = App.createPlayerContainer();
        if (!videoElement) return;
        
        const ytId = App.extractYTId(url);
        const isM3U8 = url.toLowerCase().includes('.m3u8');

        const playerConfig = {
            controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
            autoplay: true
        };

        if (ytId) {
            playerConfig.youtube = { noCookie: false, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1, origin: window.location.origin };
            App.playerInstance = new Plyr(videoElement, playerConfig);
            App.playerInstance.source = {
                type: 'video',
                sources: [{ src: ytId, provider: 'youtube' }]
            };
        } else {
            App.playerInstance = new Plyr(videoElement, playerConfig);
            if (isM3U8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(videoElement);
                App.playerInstance.hls = hls;
                App.playerInstance.on('ready', () => App.playerInstance.play());
            } else {
                videoElement.src = url;
                App.playerInstance.on('ready', () => App.playerInstance.play());
            }
        }
    },

    closePlayer: () => {
        document.body.style.overflow = 'auto';
        if (App.playerInstance) {
            if (App.playerInstance.hls) App.playerInstance.hls.destroy();
            try { App.playerInstance.stop(); App.playerInstance.destroy(); } catch (e) {}
            App.playerInstance = null;
        }
        if (App.elements.videoContainer) App.elements.videoContainer.innerHTML = '';
        if (App.elements.playerModal) App.elements.playerModal.style.display = 'none';
        App.state.currentVideoLink = null;
    },

    filterContent: (type, btn) => {
        App.updateNavButtons(btn);
        App.state.currentCategory = type;
        if (type === 'all') App.renderGrid(App.state.data);
        else App.renderGrid(App.state.data.filter(i => i.category === type));
    },

    showFavorites: (btn) => {
        App.updateNavButtons(btn);
        App.state.currentCategory = 'favorites';
        App.renderGrid(App.state.favorites);
    },

    handleSearch: (query) => {
        const q = query.toLowerCase().trim();
        const dataSource = App.state.currentCategory === 'favorites' ? App.state.favorites : App.state.data;
        App.renderGrid(q === '' ? dataSource : dataSource.filter(i => i.title.toLowerCase().includes(q)));
    },

    updateNavButtons: (activeBtn) => {
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(b => b.classList.remove('active'));
        activeBtn.classList.add('active');
    },

    showEmptyState: () => {
        if (App.elements.grid) App.elements.grid.style.display = 'none';
        if (App.elements.noResults) App.elements.noResults.style.display = 'block';
    },

    setupScrollEffect: () => {
        window.addEventListener('scroll', () => {
            if (App.elements.navbar) {
                App.elements.navbar.classList.toggle('scrolled', window.scrollY > 50);
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
