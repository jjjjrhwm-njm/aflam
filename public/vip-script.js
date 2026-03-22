/**
 * StreamFlix Pro - VIP Script
 * Version: 8.0.0
 */

const App = {
    data: [],
    groupedData: {},
    favorites: [],
    currentFilter: 'all',
    currentGenre: 'all',
    searchQuery: '',
    token: localStorage.getItem('token'),
    user: null,
    currentItem: null,
    playerInstance: null,
    state: {}, // ✅ تم إضافة كائن state

    elements: {
        grid: document.getElementById('moviesGrid'),
        skeleton: document.getElementById('skeletonLoader'),
        noResults: document.getElementById('noResults'),
        navbar: document.getElementById('navbar'),
        searchInput: document.getElementById('searchInput'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        mobileMenu: document.getElementById('mobileMenu'),
        closeMobileMenu: document.getElementById('closeMobileMenu'),
        toast: document.getElementById('toastNotification'),
        categoryTabs: document.querySelectorAll('.cat-tab'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        userMenuBtn: document.getElementById('userMenuBtn'),
        detailsModal: document.getElementById('detailsModal'),
        detailsImg: document.getElementById('detailsImg'),
        detailsTitle: document.getElementById('detailsTitle'),
        detailsQuality: document.getElementById('detailsQuality'),
        detailsYear: document.getElementById('detailsYear'),
        detailsDuration: document.getElementById('detailsDuration'),
        detailsDirector: document.getElementById('detailsDirector'),
        detailsCast: document.getElementById('detailsCast'),
        detailsRating: document.getElementById('detailsRating'),
        detailsViews: document.getElementById('detailsViews'),
        detailsDescription: document.getElementById('detailsDescription'),
        detailsPlayBtn: document.getElementById('detailsPlayBtn'),
        detailsFavBtn: document.getElementById('detailsFavBtn'),
        closeDetailsBtn: document.getElementById('closeDetailsBtn'),
        detailsPlayOverlay: document.getElementById('detailsPlayOverlay'),
        playerModal: document.getElementById('playerModal'),
        playerTitle: document.getElementById('playerTitle'),
        closePlayerBtn: document.getElementById('closePlayerBtn'),
        videoContainer: document.querySelector('.video-container')
    },

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
        App.setupScrollEffect();
        await App.loadFavorites();
        await App.fetchVIPContent();

        setTimeout(() => {
            if (App.elements.loadingOverlay) {
                App.elements.loadingOverlay.classList.add('hide');
                setTimeout(() => {
                    App.elements.loadingOverlay.style.display = 'none';
                }, 500);
            }
        }, 800);
    },

    setupEventListeners: () => {
        // Modal close
        App.elements.closeDetailsBtn?.addEventListener('click', () => App.closeDetails());
        App.elements.closePlayerBtn?.addEventListener('click', () => App.closePlayer());
        App.elements.detailsModal?.addEventListener('click', (e) => {
            if (e.target === App.elements.detailsModal) App.closeDetails();
        });
        App.elements.detailsPlayOverlay?.addEventListener('click', () => {
            if (App.currentItem) {
                App.closeDetails();
                App.playVideo(App.currentItem.link, App.currentItem.title);
            }
        });

        // Mobile menu
        App.elements.mobileMenuBtn?.addEventListener('click', () => {
            App.elements.mobileMenu?.classList.toggle('active');
        });
        App.elements.closeMobileMenu?.addEventListener('click', () => {
            App.elements.mobileMenu?.classList.remove('active');
        });
        document.addEventListener('click', (e) => {
            if (App.elements.mobileMenu?.classList.contains('active') &&
                !App.elements.mobileMenu.contains(e.target) &&
                !App.elements.mobileMenuBtn.contains(e.target)) {
                App.elements.mobileMenu.classList.remove('active');
            }
        });

        // Search
        let searchTimeout;
        App.elements.searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                App.searchQuery = e.target.value;
                App.filterContent();
            }, 300);
        });

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
                    document.querySelector('.cat-tab[data-genre="all"]')?.classList.add('active');
                    App.filterContent();
                } else if (btn.id === 'vipBtn' || btn.id === 'mobileVipBtn') {
                    // Already in VIP, do nothing or go to home?
                    return;
                }
                document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                App.elements.mobileMenu?.classList.remove('active');
            });
        });

        // Category tabs
        App.elements.categoryTabs?.forEach(tab => {
            tab.addEventListener('click', () => {
                const genre = tab.dataset.genre;
                App.currentGenre = genre;
                document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                App.filterContent();
            });
        });

        // User menu (logout)
        if (App.elements.userMenuBtn) {
            App.elements.userMenuBtn.addEventListener('click', () => {
                if (confirm('تسجيل الخروج؟')) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/';
                }
            });
        }

        // Slider navigation
        document.addEventListener('click', (e) => {
            const prevBtn = e.target.closest('.slider-nav-prev');
            const nextBtn = e.target.closest('.slider-nav-next');
            if (prevBtn) {
                const sliderId = prevBtn.dataset.slider;
                const slider = document.getElementById(sliderId);
                if (slider) slider.scrollBy({ left: -320, behavior: 'smooth' });
            }
            if (nextBtn) {
                const sliderId = nextBtn.dataset.slider;
                const slider = document.getElementById(sliderId);
                if (slider) slider.scrollBy({ left: 320, behavior: 'smooth' });
            }
        });
    },

    setupScrollEffect: () => {
        window.addEventListener('scroll', () => {
            if (App.elements.navbar) {
                App.elements.navbar.classList.toggle('scrolled', window.scrollY > 50);
            }
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
                App.groupDataByGenre();
                App.renderSliders();
            } else if (result.message === 'VIP subscription required') {
                alert('يجب أن تكون مشترك VIP للوصول إلى هذا المحتوى');
                window.location.href = '/';
            } else {
                console.error(result);
                App.showToast('فشل تحميل المحتوى', false);
            }
        } catch (err) {
            console.error(err);
            App.showToast('فشل الاتصال بالخادم', false);
        }
    },

    groupDataByGenre: () => {
        const grouped = {};
        App.data.forEach(item => {
            // ✅ معالجة التصنيف المفقود
            let genre = item.genre;
            if (!genre || genre === '') {
                genre = 'مضاف حديثاً';
            }
            if (!grouped[genre]) grouped[genre] = [];
            grouped[genre].push(item);
        });
        App.groupedData = Object.fromEntries(
            Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)
        );
    },

    filterContent: () => {
        let filtered = App.data;
        if (App.currentFilter !== 'all' && App.currentFilter !== 'favorites') {
            filtered = filtered.filter(item => item.category === App.currentFilter);
        }
        if (App.currentGenre !== 'all') {
            filtered = filtered.filter(item => item.genre === App.currentGenre);
        }
        if (App.searchQuery) {
            filtered = filtered.filter(item => item.title.includes(App.searchQuery));
        }
        const grouped = {};
        filtered.forEach(item => {
            let genre = item.genre;
            if (!genre || genre === '') genre = 'مضاف حديثاً';
            if (!grouped[genre]) grouped[genre] = [];
            grouped[genre].push(item);
        });
        App.groupedData = grouped;
        if (filtered.length === 0) {
            App.showEmptyState();
        } else {
            App.renderSliders(filtered);
        }
    },

    renderSliders: (items = null) => {
        const dataToRender = items || App.groupedData;
        const genres = Object.keys(dataToRender);

        if (!App.elements.grid) return;
        App.elements.grid.innerHTML = '';

        if (genres.length === 0) {
            App.showEmptyState();
            return;
        }

        if (App.elements.noResults) App.elements.noResults.style.display = 'none';
        if (App.elements.grid) App.elements.grid.style.display = 'block';
        if (App.elements.skeleton) App.elements.skeleton.style.display = 'none';

        genres.forEach((genre, index) => {
            const items = dataToRender[genre];
            if (!items || items.length === 0) return;

            const sliderId = `slider-${index}-${Date.now()}`;
            const section = document.createElement('div');
            section.className = 'genre-slider-section';
            section.setAttribute('data-genre', genre);

            section.innerHTML = `
                <div class="slider-header">
                    <div class="slider-title-wrapper">
                        <div class="genre-icon">
                            <i class="${App.getGenreIcon(genre)}"></i>
                        </div>
                        <h2 class="slider-title">${genre} VIP</h2>
                    </div>
                    <div class="slider-controls">
                        <button class="slider-nav-btn slider-nav-prev" data-slider="${sliderId}" aria-label="السابق">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                        <button class="slider-nav-btn slider-nav-next" data-slider="${sliderId}" aria-label="التالي">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                    </div>
                </div>
                <div class="slider-container" id="${sliderId}">
                    <div class="slider-track">
                        ${items.map(item => App.createMovieCardHTML(item)).join('')}
                    </div>
                </div>
            `;
            App.elements.grid.appendChild(section);
        });

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
    },

    createMovieCardHTML: (item) => {
        const imgUrl = `/api/image/${item.poster}`;
        const title = item.title;
        const isFav = App.favorites.some(f => f._id === item._id);
        return `
            <div class="movie-card-slider" data-id="${item._id}">
                <div class="movie-card-inner">
                    <img src="${imgUrl}" loading="lazy" alt="${title}" 
                         onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=500&auto=format&fit=crop'">
                    <div class="movie-card-overlay">
                        <button class="play-btn-overlay" onclick="event.stopPropagation(); App.playVideo('${item.link.replace(/'/g, "\\'")}', '${title.replace(/'/g, "\\'")}')">
                            <i class="fa-solid fa-play"></i>
                        </button>
                        <button class="fav-btn-overlay ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); App.toggleFavoriteFromCard('${item._id}')">
                            <i class="fa-solid ${isFav ? 'fa-heart' : 'fa-plus'}"></i>
                        </button>
                        <div class="movie-info-overlay">
                            <h4>${App.truncateText(title, 25)}</h4>
                            <div class="movie-meta">
                                <span>${item.year || '2024'}</span>
                                <span class="dot">•</span>
                                <span>VIP</span>
                            </div>
                        </div>
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
            'أخرى': 'fa-solid fa-tv',
            'مضاف حديثاً': 'fa-solid fa-clock'
        };
        return icons[genre] || 'fa-solid fa-clapperboard';
    },

    openDetails: (item) => {
        App.currentItem = item;
        const isFav = App.favorites.some(f => f._id === item._id);
        if (App.elements.detailsImg) App.elements.detailsImg.src = `/api/image/${item.poster}`;
        if (App.elements.detailsTitle) App.elements.detailsTitle.innerText = item.title;
        if (App.elements.detailsQuality) App.elements.detailsQuality.innerHTML = `<i class="fa-solid fa-circle-check"></i> VIP HD`;
        if (App.elements.detailsYear) App.elements.detailsYear.innerHTML = `<i class="fa-regular fa-calendar"></i> ${item.year || '2024'}`;
        if (App.elements.detailsDuration) App.elements.detailsDuration.innerHTML = `<i class="fa-regular fa-clock"></i> ${item.duration || '120 دقيقة'}`;
        if (App.elements.detailsDirector) App.elements.detailsDirector.innerHTML = `<i class="fa-solid fa-user"></i> المخرج: ${item.director || 'غير معروف'}`;
        if (App.elements.detailsCast) App.elements.detailsCast.innerHTML = `<i class="fa-solid fa-users"></i> الممثلين: ${item.cast?.join(', ') || 'غير معروف'}`;
        if (App.elements.detailsRating) App.elements.detailsRating.innerText = item.rating || '4.0';
        if (App.elements.detailsViews) App.elements.detailsViews.innerHTML = `<i class="fa-regular fa-eye"></i> ${item.views || 0} مشاهدة`;
        if (App.elements.detailsDescription) App.elements.detailsDescription.innerText = item.description || 'لا يوجد وصف متاح';
        if (App.elements.detailsFavBtn) {
            App.elements.detailsFavBtn.innerHTML = isFav ? '<i class="fa-solid fa-check"></i><span>في قائمتي</span>' : '<i class="fa-regular fa-heart"></i><span>أضف لقائمتي</span>';
            App.elements.detailsFavBtn.onclick = () => App.toggleFavorite(item);
        }
        if (App.elements.detailsPlayBtn) {
            App.elements.detailsPlayBtn.onclick = () => {
                App.closeDetails();
                App.playVideo(item.link, item.title);
            };
        }
        App.elements.detailsModal?.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    closeDetails: () => {
        App.elements.detailsModal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        App.currentItem = null;
    },

    toggleFavoriteFromCard: async (itemId) => {
        const item = App.data.find(i => i._id === itemId);
        if (item) {
            await App.toggleFavorite(item);
            App.renderSliders();
        }
    },

    toggleFavorite: async (item) => {
        if (!App.token) {
            alert('يرجى تسجيل الدخول أولاً');
            window.location.href = '/login';
            return;
        }
        const isFav = App.favorites.some(f => f._id === item._id);
        const action = isFav ? 'remove' : 'add';

        try {
            const res = await fetch('/api/user/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${App.token}`
                },
                body: JSON.stringify({ contentId: item._id, action })
            });
            const result = await res.json();
            if (result.success) {
                if (action === 'add') {
                    App.favorites.push(item);
                    App.showToast('تمت الإضافة إلى قائمتي');
                } else {
                    App.favorites = App.favorites.filter(f => f._id !== item._id);
                    App.showToast('تمت الإزالة من قائمتي');
                }
                if (App.currentFilter === 'favorites') {
                    App.renderFavorites();
                } else {
                    App.renderSliders();
                }
                if (App.currentItem && App.currentItem._id === item._id && App.elements.detailsFavBtn) {
                    App.elements.detailsFavBtn.innerHTML = action === 'add' ? '<i class="fa-solid fa-check"></i><span>في قائمتي</span>' : '<i class="fa-regular fa-heart"></i><span>أضف لقائمتي</span>';
                }
            } else {
                App.showToast(result.message || 'حدث خطأ', false);
            }
        } catch (error) {
            console.error(error);
            App.showToast('حدث خطأ، حاول مرة أخرى', false);
        }
    },

    renderFavorites: () => {
        const favs = App.favorites;
        if (favs.length === 0) {
            App.showEmptyState();
            return;
        }
        const grouped = {};
        favs.forEach(item => {
            let genre = item.genre;
            if (!genre || genre === '') genre = 'مضاف حديثاً';
            if (!grouped[genre]) grouped[genre] = [];
            grouped[genre].push(item);
        });
        App.groupedData = grouped;
        App.renderSliders(favs);
    },

    loadFavorites: async () => {
        if (!App.token) return;
        try {
            const res = await fetch('/api/user/favorites', {
                headers: { 'Authorization': `Bearer ${App.token}` }
            });
            const result = await res.json();
            if (result.success) App.favorites = result.data;
        } catch (error) {
            console.error('Favorites error:', error);
        }
    },

    showEmptyState: () => {
        if (App.elements.grid) App.elements.grid.style.display = 'none';
        if (App.elements.noResults) App.elements.noResults.style.display = 'block';
        if (App.elements.skeleton) App.elements.skeleton.style.display = 'none';
    },

    showToast: (message, isSuccess = true) => {
        const toast = App.elements.toast;
        if (!toast) return;
        const icon = toast.querySelector('i');
        const span = toast.querySelector('span');
        if (icon) icon.className = isSuccess ? 'fa-solid fa-check-circle' : 'fa-solid fa-exclamation-circle';
        if (span) span.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    playVideo: (url, title) => {
        if (!url) {
            App.showToast('رابط الفيديو غير متاح', false);
            return;
        }
        document.body.style.overflow = 'hidden';
        if (App.elements.playerTitle) App.elements.playerTitle.innerText = title;
        if (App.elements.playerModal) App.elements.playerModal.style.display = 'flex';

        const videoContainer = App.elements.videoContainer;
        if (!videoContainer) return;
        videoContainer.innerHTML = '';
        const videoElement = document.createElement('video');
        videoElement.id = 'plyr-video';
        videoElement.className = 'plyr-video-player';
        videoElement.controls = true;
        videoElement.setAttribute('playsinline', '');
        videoContainer.appendChild(videoElement);

        const ytId = App.extractYTId(url);
        const isM3U8 = url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('.m3u');

        const playerConfig = {
            controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'],
            autoplay: true,
            keyboard: { focused: true, global: true },
            tooltips: { controls: true, seek: true },
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
            quality: { default: 'hd', options: ['hd', 'sd'] }
        };

        if (ytId) {
            playerConfig.youtube = {
                noCookie: false,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3,
                modestbranding: 1,
                origin: window.location.origin
            };
            App.playerInstance = new Plyr(videoElement, playerConfig);
            App.playerInstance.source = {
                type: 'video',
                sources: [{ src: ytId, provider: 'youtube' }]
            };
        } else {
            App.playerInstance = new Plyr(videoElement, playerConfig);
            if (isM3U8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 90
                });
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
            try {
                App.playerInstance.stop();
                App.playerInstance.destroy();
            } catch (e) {}
            App.playerInstance = null;
        }
        if (App.elements.videoContainer) App.elements.videoContainer.innerHTML = '';
        if (App.elements.playerModal) App.elements.playerModal.style.display = 'none';
    },

    extractYTId: (url) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    truncateText: (text, maxLength) => {
        return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
    }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
