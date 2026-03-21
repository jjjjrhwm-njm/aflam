/**
 * 🚀 StreamFlix - Professional Video Streaming Platform
 * 🎬 Universal Player: Supports YouTube & Direct MP4 Links
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
        const videoDiv = document.createElement('video'); // غيرناها لـ video لدعم MP4 النظيف
        videoDiv.id = 'plyr-video';
        videoDiv.className = 'plyr-video-player';
        videoDiv.controls = true;
        videoDiv.setAttribute('playsinline', '');
        App.elements.videoContainer.appendChild(videoDiv);
        return videoDiv;
    },

    rebuildPlayer: (url) => {
        if (App.playerInstance) {
            try { App.playerInstance.destroy(); } catch (e) {}
            App.playerInstance = null;
        }
        
        const videoElement = App.createPlayerContainer();
        if (!videoElement) return null;
        
        // التحقق من نوع الرابط (يوتيوب أو مباشر MP4)
        const ytId = App.extractYTId(url);
        const isMp4 = url.toLowerCase().includes('.mp4');

        try {
            const playerConfig = {
                controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
                autoplay: false
            };

            // إذا كان يوتيوب نضع إعدادات يوتيوب
            if (ytId) {
                playerConfig.youtube = { noCookie: false, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1, origin: window.location.origin };
            }

            const player = new Plyr(videoElement, playerConfig);
            return { player, ytId, isMp4 };
        } catch (e) {
            return null;
        }
    },

    fetchData: async () => {
        try {
            App.state.isLoading = true;
            const res = await fetch('/api/content');
            const result = await res.json();
            App.state.data = result.data || [];
            
            if (App.elements.skeleton) App.elements.skeleton.style.display = 'none';
            if (App.elements.grid) App.elements.grid.style.display = 'grid';
            
            if (App.state.data.length > 0) {
                App.renderHero(App.state.data[0]);
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

    // استخراج ID يوتيوب (إن وجد)
    extractYTId: (url) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    // توليد الصور (إذا كان يوتيوب يجيب صورته، وإذا MP4 نضع صورة افتراضية أو بوستر)
    getThumbnail: (url) => {
        const ytId = App.extractYTId(url);
        if (ytId) {
            return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        }
        // صورة سينمائية افتراضية للروابط الخارجية
        return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1000&auto=format&fit=crop'; 
    },

    renderHero: (item) => {
        const imgUrl = App.getThumbnail(item.link);
        if (App.elements.heroBanner) App.elements.heroBanner.style.backgroundImage = `url('${imgUrl}')`;
        if (App.elements.heroTitle) App.elements.heroTitle.innerText = item.title;
        if (App.elements.heroPlayBtn) App.elements.heroPlayBtn.onclick = () => App.playVideo(item.link, item.title);
        if (App.elements.heroInfoBtn) App.elements.heroInfoBtn.onclick = () => App.openDetails(item);
        App.state.currentHeroItem = item;
    },

    renderGrid: (items) => {
        if (!App.elements.grid) return;
        App.elements.grid.innerHTML = '';
        if (items.length === 0) return App.showEmptyState();
        
        if (App.elements.noResults) App.elements.noResults.style.display = 'none';
        if (App.elements.grid) App.elements.grid.style.display = 'grid';

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.onclick = () => App.openDetails(item);

            card.innerHTML = `
                <img src="${App.getThumbnail(item.link)}" loading="lazy" alt="${item.title}" onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=500&auto=format&fit=crop'">
                <div class="card-overlay">
                    <div class="play-icon-circle"><i class="fa-solid fa-play"></i></div>
                    <h3>${App.truncateText(item.title, 30)}</h3>
                </div>
            `;
            App.elements.grid.appendChild(card);
        });
    },

    truncateText: (text, maxLength) => {
        return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
    },

    openDetails: (item) => {
        const isFav = App.state.favorites.some(f => f._id === item._id);
        if (App.elements.detailsImg) App.elements.detailsImg.src = App.getThumbnail(item.link);
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
        App.openDetails(item); // تحديث الزر
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

    // الدالة الخارقة: تدعم اليوتيوب، وتدعم روابط MP4 المباشرة
    playVideo: (url, title) => {
        App.state.currentVideoLink = url;
        document.body.style.overflow = 'hidden';
        if (App.elements.playerTitle) App.elements.playerTitle.innerText = title;
        if (App.elements.playerModal) App.elements.playerModal.style.display = 'flex';
        
        const playerSetup = App.rebuildPlayer(url);
        if (!playerSetup) {
            App.closePlayer();
            App.showToast('حدث خطأ في المشغل', false);
            return;
        }
        
        App.playerInstance = playerSetup.player;
        
        // إذا كان الرابط يوتيوب
        if (playerSetup.ytId) {
            App.playerInstance.source = {
                type: 'video',
                sources: [{ src: playerSetup.ytId, provider: 'youtube' }]
            };
        } 
        // إذا كان الرابط خارجي (MP4 أو غيره)
        else {
            App.playerInstance.source = {
                type: 'video',
                title: title,
                sources: [{ src: url, type: 'video/mp4' }]
            };
        }
    },

    closePlayer: () => {
        document.body.style.overflow = 'auto';
        if (App.playerInstance) {
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
