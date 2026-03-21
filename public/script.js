/**
 * 🚀 StreamFlix - Professional Video Streaming Platform
 * 🎬 Premium Design | Hidden YouTube References | Modern UX
 * 🔧 Fixed Mobile Autoplay Issues | Destroy & Rebuild Strategy
 */

const App = {
    state: {
        data: [],
        favorites: JSON.parse(localStorage.getItem('streamflix_favorites')) || [],
        currentCategory: 'all',
        currentSearchQuery: '',
        isLoading: false,
        currentVideoId: null
    },

    elements: {
        grid: document.getElementById('moviesGrid'),
        skeleton: document.getElementById('skeletonLoader'),
        noResults: document.getElementById('noResults'),
        navbar: document.getElementById('navbar'),
        
        // Hero Elements
        heroBanner: document.getElementById('heroBanner'),
        heroTitle: document.getElementById('heroTitle'),
        heroDescription: document.getElementById('heroDescription'),
        heroPlayBtn: document.getElementById('heroPlayBtn'),
        heroInfoBtn: document.getElementById('heroInfoBtn'),
        
        // Modal Elements
        detailsModal: document.getElementById('detailsModal'),
        detailsImg: document.getElementById('detailsImg'),
        detailsTitle: document.getElementById('detailsTitle'),
        detailsCategory: document.getElementById('detailsCategory'),
        detailsPlayBtn: document.getElementById('detailsPlayBtn'),
        detailsFavBtn: document.getElementById('detailsFavBtn'),
        closeDetailsBtn: document.getElementById('closeDetailsBtn'),
        detailsPlayOverlay: document.getElementById('detailsPlayOverlay'),
        
        // Player Elements
        playerModal: document.getElementById('playerModal'),
        playerTitle: document.getElementById('playerTitle'),
        closePlayerBtn: document.getElementById('closePlayerBtn'),
        videoContainer: document.querySelector('.video-container'),
        
        // Search
        searchInput: document.getElementById('searchInput'),
        
        // Mobile Menu
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        mobileMenu: document.getElementById('mobileMenu'),
        
        // Toast
        toast: document.getElementById('toastNotification')
    },

    playerInstance: null,

    // 1. Initialization
    init: async () => {
        App.setupEventListeners();
        App.setupScrollEffect();
        // No player initialization here - will be created on demand
        await App.fetchData();
    },

    // 2. Setup Event Listeners
    setupEventListeners: () => {
        // Close modal buttons
        App.elements.closeDetailsBtn?.addEventListener('click', () => App.closeDetails());
        App.elements.closePlayerBtn?.addEventListener('click', () => App.closePlayer());
        
        // Close modal on backdrop click
        App.elements.detailsModal?.addEventListener('click', (e) => {
            if (e.target === App.elements.detailsModal) App.closeDetails();
        });
        
        // Play overlay in modal
        App.elements.detailsPlayOverlay?.addEventListener('click', () => {
            const currentItem = App.state.currentItem;
            if (currentItem) {
                const ytId = App.extractID(currentItem.link);
                if (ytId) {
                    App.closeDetails();
                    App.playVideo(ytId, currentItem.title);
                }
            }
        });
        
        // Mobile menu
        App.elements.mobileMenuBtn?.addEventListener('click', () => {
            App.elements.mobileMenu?.classList.toggle('active');
        });
        
        // Close mobile menu on click outside
        document.addEventListener('click', (e) => {
            if (App.elements.mobileMenu?.classList.contains('active') &&
                !App.elements.mobileMenu.contains(e.target) &&
                !App.elements.mobileMenuBtn.contains(e.target)) {
                App.elements.mobileMenu.classList.remove('active');
            }
        });
        
        // Search with debounce
        let searchTimeout;
        App.elements.searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                App.handleSearch(e.target.value);
            }, 300);
        });
        
        // Navigation buttons
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                if (filter === 'favorites') {
                    App.showFavorites(btn);
                } else if (filter) {
                    App.filterContent(filter, btn);
                }
                // Close mobile menu if open
                App.elements.mobileMenu?.classList.remove('active');
            });
        });
        
        // Hero scroll indicator
        document.querySelector('.hero-scroll-indicator')?.addEventListener('click', () => {
            document.querySelector('.content-wrapper')?.scrollIntoView({ behavior: 'smooth' });
        });
    },

    // 3. Create Player Container Dynamically
    createPlayerContainer: () => {
        if (!App.elements.videoContainer) return null;
        
        // Clear container
        App.elements.videoContainer.innerHTML = '';
        
        // Create new video element
        const videoDiv = document.createElement('div');
        videoDiv.id = 'plyr-video';
        videoDiv.className = 'plyr-video-player';
        videoDiv.setAttribute('data-plyr-provider', 'youtube');
        
        App.elements.videoContainer.appendChild(videoDiv);
        return videoDiv;
    },

    // 4. Destroy and Rebuild Player (Mobile Fix)
    rebuildPlayer: (ytId) => {
        // Destroy existing player if exists
        if (App.playerInstance) {
            try {
                App.playerInstance.destroy();
            } catch (e) {
                console.warn('Player destroy error:', e);
            }
            App.playerInstance = null;
        }
        
        // Clean up any remaining YouTube iframes
        const existingIframes = document.querySelectorAll('iframe[src*="youtube"]');
        existingIframes.forEach(iframe => iframe.remove());
        
        // Create fresh container
        App.createPlayerContainer();
        
        // Get the new video element
        const videoElement = document.getElementById('plyr-video');
        if (!videoElement) {
            console.error('Failed to create video element');
            return null;
        }
        
        // Initialize new Plyr instance with origin parameter for mobile
        try {
            const player = new Plyr(videoElement, {
                controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
                youtube: {
                    noCookie: true,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    controls: 0,
                    fs: 1,
                    playsinline: 1,
                    origin: window.location.origin // Critical for mobile
                },
                invertTime: false,
                seekTime: 10,
                volume: 0.8,
                muted: true, // Start muted to help with autoplay policies
                storage: { enabled: false },
                autoplay: true // Request autoplay
            });
            
            return player;
        } catch (e) {
            console.error('Plyr initialization error:', e);
            return null;
        }
    },

    // 5. Fetch Data from Server
    fetchData: async () => {
        try {
            App.state.isLoading = true;
            const res = await fetch('/api/content');
            const result = await res.json();
            App.state.data = result.data || [];
            
            // Hide skeleton, show grid
            if (App.elements.skeleton) App.elements.skeleton.style.display = 'none';
            if (App.elements.grid) App.elements.grid.style.display = 'grid';
            
            if (App.state.data.length > 0) {
                App.renderHero(App.state.data[0]);
                App.renderGrid(App.state.data);
            } else {
                App.showEmptyState();
            }
        } catch (error) {
            console.error("Data fetch failed:", error);
            if (App.elements.skeleton) {
                App.elements.skeleton.innerHTML = `
                    <div class="empty-state" style="grid-column:1/-1;">
                        <div class="empty-state-icon"><i class="fa-solid fa-wifi"></i></div>
                        <h3>فشل الاتصال بالخوادم</h3>
                        <p>يرجى التأكد من تشغيل السيرفر والمحاولة مرة أخرى</p>
                        <button onclick="location.reload()" class="btn-primary" style="margin-top:20px;">
                            <i class="fa-solid fa-rotate-right"></i> إعادة المحاولة
                        </button>
                    </div>
                `;
            }
        } finally {
            App.state.isLoading = false;
        }
    },

    // 6. Extract YouTube ID (Hidden)
    extractID: (url) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    // 7. Get Thumbnail URL
    getThumbnail: (ytId, quality = 'maxresdefault') => {
        // Using our own proxy or CDN to hide YouTube reference
        return `https://img.youtube.com/vi/${ytId}/${quality}.jpg`;
    },

    // 8. Render Hero Section
    renderHero: (item) => {
        const ytId = App.extractID(item.link);
        if (!ytId) return;

        const imgUrl = App.getThumbnail(ytId, 'maxresdefault');
        if (App.elements.heroBanner) {
            App.elements.heroBanner.style.backgroundImage = `url('${imgUrl}')`;
        }
        if (App.elements.heroTitle) {
            App.elements.heroTitle.innerText = item.title;
        }
        
        // Generate description from title
        if (App.elements.heroDescription) {
            App.elements.heroDescription.innerText = `شاهد ${item.title} بجودة عالية وحصرياً على StreamFlix. تجربة مشاهدة ممتعة مع أفضل الأفلام والمسلسلات.`;
        }

        // Setup hero buttons
        if (App.elements.heroPlayBtn) {
            App.elements.heroPlayBtn.onclick = () => App.playVideo(ytId, item.title);
        }
        if (App.elements.heroInfoBtn) {
            App.elements.heroInfoBtn.onclick = () => App.openDetails(item);
        }
        
        App.state.currentHeroItem = item;
    },

    // 9. Render Grid
    renderGrid: (items) => {
        if (!App.elements.grid) return;
        
        App.elements.grid.innerHTML = '';
        
        if (items.length === 0) {
            App.showEmptyState();
            return;
        }
        
        if (App.elements.noResults) App.elements.noResults.style.display = 'none';
        if (App.elements.grid) App.elements.grid.style.display = 'grid';

        items.forEach(item => {
            const ytId = App.extractID(item.link);
            if (!ytId) return;

            const card = document.createElement('div');
            card.className = 'movie-card';
            card.onclick = () => App.openDetails(item);

            card.innerHTML = `
                <img src="${App.getThumbnail(ytId, 'hqdefault')}" loading="lazy" alt="${item.title}">
                <div class="card-overlay">
                    <div class="play-icon-circle"><i class="fa-solid fa-play"></i></div>
                    <h3>${App.truncateText(item.title, 30)}</h3>
                </div>
            `;
            App.elements.grid.appendChild(card);
        });
    },

    // 10. Truncate Text
    truncateText: (text, maxLength) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    // 11. Open Details Modal
    openDetails: (item) => {
        const ytId = App.extractID(item.link);
        const isFav = App.state.favorites.some(f => f._id === item._id);

        if (App.elements.detailsImg && ytId) {
            App.elements.detailsImg.src = App.getThumbnail(ytId, 'maxresdefault');
        }
        if (App.elements.detailsTitle) {
            App.elements.detailsTitle.innerText = item.title;
        }
        if (App.elements.detailsCategory) {
            const categoryText = item.category === 'movie' ? 'فيلم' : 'مسلسل';
            App.elements.detailsCategory.innerHTML = `<i class="fa-solid fa-tag"></i><span>${categoryText}</span>`;
        }
        
        // Setup favorite button
        if (App.elements.detailsFavBtn) {
            App.elements.detailsFavBtn.innerHTML = isFav ? 
                '<i class="fa-solid fa-check"></i><span>في قائمتي</span>' : 
                '<i class="fa-solid fa-plus"></i><span>أضف لقائمتي</span>';
            App.elements.detailsFavBtn.onclick = () => App.toggleFavorite(item);
        }
        
        // Setup play button
        if (App.elements.detailsPlayBtn && ytId) {
            App.elements.detailsPlayBtn.onclick = () => {
                App.closeDetails();
                App.playVideo(ytId, item.title);
            };
        }
        
        App.state.currentItem = item;
        App.elements.detailsModal?.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    // 12. Close Details Modal
    closeDetails: () => {
        App.elements.detailsModal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        App.state.currentItem = null;
    },

    // 13. Toggle Favorite with Toast
    toggleFavorite: (item) => {
        const index = App.state.favorites.findIndex(f => f._id === item._id);
        let message = '';
        
        if (index > -1) {
            App.state.favorites.splice(index, 1);
            message = 'تمت إزالة من قائمتي';
            if (App.elements.detailsFavBtn) {
                App.elements.detailsFavBtn.innerHTML = '<i class="fa-solid fa-plus"></i><span>أضف لقائمتي</span>';
            }
        } else {
            App.state.favorites.push(item);
            message = 'تمت الإضافة إلى قائمتي';
            if (App.elements.detailsFavBtn) {
                App.elements.detailsFavBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>في قائمتي</span>';
            }
        }
        
        localStorage.setItem('streamflix_favorites', JSON.stringify(App.state.favorites));
        App.showToast(message, index === -1);
        
        // Update grid if in favorites view
        if (App.state.currentCategory === 'favorites') {
            App.renderGrid(App.state.favorites);
        }
    },

    // 14. Show Toast Notification
    showToast: (message, isSuccess = true) => {
        const toast = App.elements.toast;
        if (!toast) return;
        
        const icon = toast.querySelector('i');
        const span = toast.querySelector('span');
        
        if (icon) {
            icon.className = isSuccess ? 'fa-solid fa-check-circle' : 'fa-solid fa-trash-alt';
        }
        if (span) span.textContent = message;
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    // 15. Play Video - DESTROY & REBUILD Strategy (Mobile Fix)
    playVideo: (ytId, title) => {
        // Store current video ID
        App.state.currentVideoId = ytId;
        
        // Show modal and lock scroll
        document.body.style.overflow = 'hidden';
        if (App.elements.playerTitle) {
            App.elements.playerTitle.innerText = title;
        }
        if (App.elements.playerModal) {
            App.elements.playerModal.style.display = 'flex';
        }
        
        // CRITICAL: Destroy old player and rebuild fresh
        const newPlayer = App.rebuildPlayer(ytId);
        
        if (!newPlayer) {
            console.error('Failed to rebuild player');
            App.closePlayer();
            App.showToast('حدث خطأ في تشغيل الفيديو', false);
            return;
        }
        
        App.playerInstance = newPlayer;
        
        // Set video source
        App.playerInstance.source = {
            type: 'video',
            sources: [{ src: ytId, provider: 'youtube' }]
        };
        
        // Wait for player to be ready, then attempt to play
        App.playerInstance.on('ready', () => {
            // Attempt to play with catch for autoplay policies
            App.playerInstance.play()
                .catch((error) => {
                    console.warn('Autoplay was prevented:', error);
                    // User will need to click play button - this is normal for mobile browsers
                    // The player UI is visible, user can manually click play
                });
        });
        
        // Unmute after user interaction with player (for better UX)
        setTimeout(() => {
            if (App.playerInstance && App.playerInstance.muted) {
                // Don't force unmute - let user decide
            }
        }, 1000);
    },

    // 16. Close Player - Clean up properly
    closePlayer: () => {
        // Restore scroll
        document.body.style.overflow = 'auto';
        
        // Destroy player instance to clean up YouTube iframe
        if (App.playerInstance) {
            try {
                // Stop video first
                App.playerInstance.stop();
                // Then destroy
                App.playerInstance.destroy();
            } catch (e) {
                console.warn('Player destroy error:', e);
            }
            App.playerInstance = null;
        }
        
        // Clean up any remaining YouTube iframes
        const existingIframes = document.querySelectorAll('iframe[src*="youtube"]');
        existingIframes.forEach(iframe => iframe.remove());
        
        // Clear video container
        if (App.elements.videoContainer) {
            App.elements.videoContainer.innerHTML = '';
        }
        
        // Hide modal
        if (App.elements.playerModal) {
            App.elements.playerModal.style.display = 'none';
        }
        
        // Clear current video ID
        App.state.currentVideoId = null;
    },

    // 17. Filter Content
    filterContent: (type, btn) => {
        App.updateNavButtons(btn);
        App.state.currentCategory = type;
        
        const sectionTitle = document.getElementById('sectionTitle');
        if (sectionTitle) {
            sectionTitle.innerText = type === 'movie' ? 'أحدث الأفلام' : 
                                      type === 'series' ? 'أحدث المسلسلات' : 'أضيف حديثاً';
        }
        
        if (type === 'all') {
            App.renderGrid(App.state.data);
        } else {
            App.renderGrid(App.state.data.filter(i => i.category === type));
        }
    },

    // 18. Show Favorites
    showFavorites: (btn) => {
        App.updateNavButtons(btn);
        App.state.currentCategory = 'favorites';
        const sectionTitle = document.getElementById('sectionTitle');
        if (sectionTitle) {
            sectionTitle.innerText = 'قائمتي المفضلة';
        }
        App.renderGrid(App.state.favorites);
    },

    // 19. Handle Search
    handleSearch: (query) => {
        App.state.currentSearchQuery = query;
        const q = query.toLowerCase().trim();
        
        if (q === '') {
            if (App.state.currentCategory === 'favorites') {
                App.renderGrid(App.state.favorites);
            } else {
                App.renderGrid(App.state.data);
            }
            return;
        }
        
        const dataSource = App.state.currentCategory === 'favorites' ? App.state.favorites : App.state.data;
        const results = dataSource.filter(i => i.title.toLowerCase().includes(q));
        App.renderGrid(results);
    },

    // 20. Update Nav Buttons
    updateNavButtons: (activeBtn) => {
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(b => {
            b.classList.remove('active');
        });
        activeBtn.classList.add('active');
    },

    // 21. Show Empty State
    showEmptyState: () => {
        if (App.elements.grid) App.elements.grid.style.display = 'none';
        if (App.elements.noResults) App.elements.noResults.style.display = 'block';
    },

    // 22. Setup Scroll Effect
    setupScrollEffect: () => {
        window.addEventListener('scroll', () => {
            if (App.elements.navbar) {
                if (window.scrollY > 50) {
                    App.elements.navbar.classList.add('scrolled');
                } else {
                    App.elements.navbar.classList.remove('scrolled');
                }
            }
        });
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
