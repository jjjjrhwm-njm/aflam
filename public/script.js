/**
 * 🚀 StreamFlix Pro - Netflix Style Slider Edition
 * 🎬 Advanced Horizontal Slider for Each Genre
 * 👑 Version: 6.1 - Cinematic Experience
 */

const App = {
    state: {
        data: [],
        groupedData: {},
        favorites: [],
        currentCategory: 'all',
        currentGenre: 'all',
        currentSearchQuery: '',
        isLoading: false,
        currentVideoLink: null,
        currentPage: 1,
        hasMore: true,
        userId: localStorage.getItem('userId') || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        activeSliderIndex: null
    },

    elements: {
        grid: document.getElementById('moviesGrid'),
        skeleton: document.getElementById('skeletonLoader'),
        noResults: document.getElementById('noResults'),
        navbar: document.getElementById('navbar'),
        heroBanner: document.getElementById('heroBanner'),
        heroTitle: document.getElementById('heroTitle'),
        heroYear: document.getElementById('heroYear'),
        heroQuality: document.getElementById('heroQuality'),
        heroDuration: document.getElementById('heroDuration'),
        heroRating: document.getElementById('heroRating'),
        heroDescription: document.getElementById('heroDescription'),
        heroPlayBtn: document.getElementById('heroPlayBtn'),
        heroInfoBtn: document.getElementById('heroInfoBtn'),
        heroFavBtn: document.getElementById('heroFavBtn'),
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
        videoContainer: document.querySelector('.video-container'),
        searchInput: document.getElementById('searchInput'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        mobileMenu: document.getElementById('mobileMenu'),
        closeMobileMenu: document.getElementById('closeMobileMenu'),
        toast: document.getElementById('toastNotification'),
        announcementBar: document.getElementById('announcementBar'),
        announcementText: document.getElementById('announcementText'),
        closeAnnouncement: document.getElementById('closeAnnouncement'),
        categoryTabs: document.querySelectorAll('.cat-tab'),
        loadingOverlay: document.getElementById('loadingOverlay')
    },

    playerInstance: null,

    init: async () => {
        // Store user ID
        if (!localStorage.getItem('userId')) {
            localStorage.setItem('userId', App.state.userId);
        } else {
            App.state.userId = localStorage.getItem('userId');
        }
        
        App.setupEventListeners();
        App.setupScrollEffect();
        await App.loadFavorites();
        await App.fetchAnnouncements();
        await App.fetchData();
        
        // Hide loading overlay
        setTimeout(() => {
            if (App.elements.loadingOverlay) {
                App.elements.loadingOverlay.classList.add('hide');
                setTimeout(() => {
                    App.elements.loadingOverlay.style.display = 'none';
                }, 500);
            }
        }, 1000);
    },

    setupEventListeners: () => {
        // Modal close buttons
        App.elements.closeDetailsBtn?.addEventListener('click', () => App.closeDetails());
        App.elements.closePlayerBtn?.addEventListener('click', () => App.closePlayer());
        App.elements.closeAnnouncement?.addEventListener('click', () => App.closeAnnouncement());
        
        // Modal backdrop click
        App.elements.detailsModal?.addEventListener('click', (e) => {
            if (e.target === App.elements.detailsModal) App.closeDetails();
        });
        
        // Play overlay
        App.elements.detailsPlayOverlay?.addEventListener('click', () => {
            const currentItem = App.state.currentItem;
            if (currentItem) {
                App.closeDetails();
                App.playVideo(currentItem.link, currentItem.title);
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
                App.elements.mobileMenu?.classList.remove('active');
            });
        });
        
        // Category tabs
        App.elements.categoryTabs?.forEach(tab => {
            tab.addEventListener('click', () => {
                const genre = tab.dataset.genre;
                App.filterByGenre(genre, tab);
            });
        });
        
        // Hero favorite button
        App.elements.heroFavBtn?.addEventListener('click', () => {
            if (App.state.currentHeroItem) {
                App.toggleFavorite(App.state.currentHeroItem);
            }
        });
        
        // Navigation slider buttons (Previous/Next)
        document.addEventListener('click', (e) => {
            const prevBtn = e.target.closest('.slider-nav-prev');
            const nextBtn = e.target.closest('.slider-nav-next');
            
            if (prevBtn) {
                const sliderId = prevBtn.dataset.slider;
                const slider = document.getElementById(sliderId);
                if (slider) {
                    slider.scrollBy({ left: -320, behavior: 'smooth' });
                }
            }
            
            if (nextBtn) {
                const sliderId = nextBtn.dataset.slider;
                const slider = document.getElementById(sliderId);
                if (slider) {
                    slider.scrollBy({ left: 320, behavior: 'smooth' });
                }
            }
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

    fetchData: async (reset = true) => {
        try {
            if (reset) {
                App.state.isLoading = true;
                App.state.currentPage = 1;
                if (App.elements.skeleton) App.elements.skeleton.style.display = 'block';
                if (App.elements.grid) App.elements.grid.style.display = 'none';
            }
            
            const params = new URLSearchParams({
                page: App.state.currentPage,
                limit: 50
            });
            
            if (App.state.currentCategory !== 'all' && App.state.currentCategory !== 'favorites') {
                params.append('category', App.state.currentCategory);
            }
            
            if (App.state.currentGenre !== 'all') {
                params.append('genre', App.state.currentGenre);
            }
            
            if (App.state.currentSearchQuery) {
                params.append('search', App.state.currentSearchQuery);
            }
            
            const res = await fetch(`/api/content?${params}`);
            const result = await res.json();
            
            if (result.status === 'success') {
                if (reset) {
                    App.state.data = result.data;
                } else {
                    App.state.data = [...App.state.data, ...result.data];
                }
                
                App.state.hasMore = result.data.length === 50;
                
                if (App.state.data.length > 0) {
                    // Group data by genre
                    App.groupDataByGenre();
                    
                    if (reset && App.state.currentCategory !== 'favorites') {
                        App.renderHero(App.state.data[0]);
                    }
                    App.renderSliders();
                    if (App.elements.loadMoreContainer) {
                        App.elements.loadMoreContainer.style.display = App.state.hasMore ? 'block' : 'none';
                    }
                } else {
                    App.showEmptyState();
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
            App.showError('فشل الاتصال بالخادم');
        } finally {
            if (reset) {
                App.state.isLoading = false;
                if (App.elements.skeleton) App.elements.skeleton.style.display = 'none';
                if (App.elements.grid) App.elements.grid.style.display = 'block';
            }
        }
    },

    groupDataByGenre: () => {
        const grouped = {};
        
        App.state.data.forEach(item => {
            const genre = item.genre || 'أخرى';
            if (!grouped[genre]) {
                grouped[genre] = [];
            }
            grouped[genre].push(item);
        });
        
        // Sort genres by number of items (popular first)
        App.state.groupedData = Object.fromEntries(
            Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)
        );
    },

    renderSliders: () => {
        if (!App.elements.grid) return;
        App.elements.grid.innerHTML = '';
        
        const genres = Object.keys(App.state.groupedData);
        
        if (genres.length === 0) {
            App.showEmptyState();
            return;
        }
        
        if (App.elements.noResults) App.elements.noResults.style.display = 'none';
        if (App.elements.grid) App.elements.grid.style.display = 'block';
        
        genres.forEach((genre, index) => {
            const items = App.state.groupedData[genre];
            if (items.length === 0) return;
            
            const sliderId = `slider-${index}-${Date.now()}`;
            const section = document.createElement('div');
            section.className = 'genre-slider-section';
            section.setAttribute('data-genre', genre);
            
            // Create header with navigation buttons
            section.innerHTML = `
                <div class="slider-header">
                    <div class="slider-title-wrapper">
                        <div class="genre-icon">
                            <i class="${App.getGenreIcon(genre)}"></i>
                        </div>
                        <h2 class="slider-title">${genre}</h2>
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
        
        // Attach click events to movie cards
        document.querySelectorAll('.movie-card-slider').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = card.dataset.id;
                const item = App.state.data.find(i => i._id === itemId);
                if (item) App.openDetails(item);
            });
        });
        
        // Add scroll shadow effect to sliders
        document.querySelectorAll('.slider-container').forEach(container => {
            App.addScrollShadowEffect(container);
            container.addEventListener('scroll', () => App.addScrollShadowEffect(container));
        });
    },

    createMovieCardHTML: (item) => {
        const imgUrl = App.getThumbnail(item);
        const title = item.titleAr || item.title;
        const isFav = App.state.favorites.some(f => f._id === item._id);
        
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
                                <span>${item.quality || 'HD'}</span>
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
        
        if (scrollLeft <= 5) {
            container.classList.remove('scrolled-left');
        } else {
            container.classList.add('scrolled-left');
        }
        
        if (scrollLeft >= maxScroll - 5) {
            container.classList.remove('scrolled-right');
        } else {
            container.classList.add('scrolled-right');
        }
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

    renderHero: (item) => {
        const imgUrl = App.getThumbnail(item);
        if (App.elements.heroBanner) App.elements.heroBanner.style.backgroundImage = `url('${imgUrl}')`;
        if (App.elements.heroTitle) App.elements.heroTitle.innerText = item.titleAr || item.title;
        if (App.elements.heroYear) App.elements.heroYear.innerHTML = `<i class="fa-regular fa-calendar"></i> ${item.year || '2024'}`;
        if (App.elements.heroQuality) App.elements.heroQuality.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${item.quality || 'HD'}`;
        if (App.elements.heroDuration) App.elements.heroDuration.innerHTML = `<i class="fa-regular fa-clock"></i> ${item.duration || '120 دقيقة'}`;
        if (App.elements.heroRating) App.elements.heroRating.innerText = item.rating || '4.5';
        if (App.elements.heroDescription) App.elements.heroDescription.innerText = item.description || 'لا يوجد وصف متاح';
        
        const isFav = App.state.favorites.some(f => f._id === item._id);
        if (App.elements.heroFavBtn) {
            App.elements.heroFavBtn.innerHTML = isFav ? '<i class="fa-solid fa-heart"></i><span>في قائمتي</span>' : '<i class="fa-regular fa-heart"></i><span>أضف لقائمتي</span>';
        }
        
        if (App.elements.heroPlayBtn) App.elements.heroPlayBtn.onclick = () => App.playVideo(item.link, item.title);
        if (App.elements.heroInfoBtn) App.elements.heroInfoBtn.onclick = () => App.openDetails(item);
        
        App.state.currentHeroItem = item;
    },

    toggleFavoriteFromCard: async (itemId) => {
        const item = App.state.data.find(i => i._id === itemId);
        if (item) {
            await App.toggleFavorite(item);
            // Refresh sliders to update button states
            App.renderSliders();
        }
    },

    filterByGenre: (genre, activeTab) => {
        App.state.currentGenre = genre;
        
        // Update active tab
        App.elements.categoryTabs.forEach(tab => {
            tab.classList.remove('active');
        });
        if (activeTab) activeTab.classList.add('active');
        
        App.filterAndRender();
    },

    filterContent: (type, btn) => {
        App.updateNavButtons(btn);
        App.state.currentCategory = type;
        App.state.currentGenre = 'all';
        App.state.currentSearchQuery = '';
        
        // Reset category tabs
        App.elements.categoryTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.genre === 'all') tab.classList.add('active');
        });
        
        if (App.elements.searchInput) App.elements.searchInput.value = '';
        
        if (type === 'favorites') {
            App.renderFavoritesSliders();
            if (App.elements.loadMoreContainer) App.elements.loadMoreContainer.style.display = 'none';
        } else {
            App.state.currentPage = 1;
            App.fetchData(true);
        }
    },

    renderFavoritesSliders: () => {
        if (!App.elements.grid) return;
        App.elements.grid.innerHTML = '';
        
        if (App.state.favorites.length === 0) {
            App.showEmptyState();
            return;
        }
        
        if (App.elements.noResults) App.elements.noResults.style.display = 'none';
        if (App.elements.grid) App.elements.grid.style.display = 'block';
        
        // Group favorites by genre
        const groupedFavs = {};
        App.state.favorites.forEach(item => {
            const genre = item.genre || 'أخرى';
            if (!groupedFavs[genre]) {
                groupedFavs[genre] = [];
            }
            groupedFavs[genre].push(item);
        });
        
        const genres = Object.keys(groupedFavs);
        
        genres.forEach((genre, index) => {
            const items = groupedFavs[genre];
            if (items.length === 0) return;
            
            const sliderId = `fav-slider-${index}-${Date.now()}`;
            const section = document.createElement('div');
            section.className = 'genre-slider-section';
            section.setAttribute('data-genre', genre);
            
            section.innerHTML = `
                <div class="slider-header">
                    <div class="slider-title-wrapper">
                        <div class="genre-icon">
                            <i class="${App.getGenreIcon(genre)}"></i>
                        </div>
                        <h2 class="slider-title">${genre} - المفضلة</h2>
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
        
        // Attach click events to movie cards
        document.querySelectorAll('.movie-card-slider').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = card.dataset.id;
                const item = App.state.favorites.find(i => i._id === itemId);
                if (item) App.openDetails(item);
            });
        });
        
        // Add scroll shadow effect
        document.querySelectorAll('.slider-container').forEach(container => {
            App.addScrollShadowEffect(container);
            container.addEventListener('scroll', () => App.addScrollShadowEffect(container));
        });
    },

    filterAndRender: () => {
        if (App.state.currentCategory === 'favorites') {
            App.renderFavoritesSliders();
        } else {
            App.state.currentPage = 1;
            App.fetchData(true);
        }
    },

    showFavorites: (btn) => {
        App.updateNavButtons(btn);
        App.state.currentCategory = 'favorites';
        App.state.currentGenre = 'all';
        App.state.currentSearchQuery = '';
        
        if (App.elements.searchInput) App.elements.searchInput.value = '';
        
        App.renderFavoritesSliders();
        if (App.elements.loadMoreContainer) App.elements.loadMoreContainer.style.display = 'none';
    },

    handleSearch: async (query) => {
        App.state.currentSearchQuery = query;
        
        if (query.trim() === '') {
            if (App.state.currentCategory === 'favorites') {
                App.renderFavoritesSliders();
            } else {
                App.state.currentPage = 1;
                await App.fetchData(true);
            }
            return;
        }
        
        try {
            const params = new URLSearchParams({
                search: query,
                limit: 50
            });
            
            if (App.state.currentCategory !== 'all' && App.state.currentCategory !== 'favorites') {
                params.append('category', App.state.currentCategory);
            }
            
            const res = await fetch(`/api/content?${params}`);
            const result = await res.json();
            
            if (result.status === 'success') {
                App.state.data = result.data;
                App.groupDataByGenre();
                App.renderSliders();
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    },

    openDetails: (item) => {
        const isFav = App.state.favorites.some(f => f._id === item._id);
        
        if (App.elements.detailsImg) App.elements.detailsImg.src = App.getThumbnail(item);
        if (App.elements.detailsTitle) App.elements.detailsTitle.innerText = item.titleAr || item.title;
        if (App.elements.detailsQuality) App.elements.detailsQuality.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${item.quality || 'HD'}`;
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
        
        App.state.currentItem = item;
        App.elements.detailsModal?.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    closeDetails: () => {
        App.elements.detailsModal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        App.state.currentItem = null;
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
            
            const result = await res.json();
            if (result.status === 'success') {
                if (action === 'add') {
                    App.state.favorites.push(item);
                    App.showToast('تمت الإضافة إلى قائمتي', true);
                } else {
                    App.state.favorites = App.state.favorites.filter(f => f._id !== item._id);
                    App.showToast('تمت الإزالة من قائمتي', false);
                }
                
                // Update UI
                if (App.state.currentHeroItem && App.state.currentHeroItem._id === item._id && App.elements.heroFavBtn) {
                    App.elements.heroFavBtn.innerHTML = action === 'add' ? '<i class="fa-solid fa-heart"></i><span>في قائمتي</span>' : '<i class="fa-regular fa-heart"></i><span>أضف لقائمتي</span>';
                }
                
                if (App.state.currentItem && App.state.currentItem._id === item._id && App.elements.detailsFavBtn) {
                    App.elements.detailsFavBtn.innerHTML = action === 'add' ? '<i class="fa-solid fa-check"></i><span>في قائمتي</span>' : '<i class="fa-regular fa-heart"></i><span>أضف لقائمتي</span>';
                }
                
                // Refresh current view
                if (App.state.currentCategory === 'favorites') {
                    App.renderFavoritesSliders();
                } else {
                    App.renderSliders();
                }
            }
        } catch (error) {
            console.error('Favorite error:', error);
            App.showToast('حدث خطأ، حاول مرة أخرى', false);
        }
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

    showError: (message) => {
        App.showToast(message, false);
    },

    playVideo: (url, title) => {
        App.state.currentVideoLink = url;
        document.body.style.overflow = 'hidden';
        if (App.elements.playerTitle) App.elements.playerTitle.innerText = title;
        if (App.elements.playerModal) App.elements.playerModal.style.display = 'flex';
        
        const videoElement = App.createPlayerContainer();
        if (!videoElement) return;
        
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
        App.state.currentVideoLink = null;
    },

    fetchAnnouncements: async () => {
        try {
            const res = await fetch('/api/announcements');
            const result = await res.json();
            if (result.status === 'success' && result.data.length > 0) {
                const announcement = result.data[0];
                if (App.elements.announcementText) {
                    App.elements.announcementText.textContent = announcement.message;
                }
                if (App.elements.announcementBar) {
                    App.elements.announcementBar.style.display = 'flex';
                }
            }
        } catch (error) {
            console.error('Announcement error:', error);
        }
    },

    closeAnnouncement: () => {
        if (App.elements.announcementBar) {
            App.elements.announcementBar.style.display = 'none';
        }
    },

    loadFavorites: async () => {
        try {
            const res = await fetch(`/api/user/${App.state.userId}/favorites`);
            const result = await res.json();
            if (result.status === 'success') {
                App.state.favorites = result.data;
            }
        } catch (error) {
            console.error('Favorites error:', error);
        }
    },

    extractYTId: (url) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    getThumbnail: (item) => {
        if (item && item.poster) {
            return `/api/image/${item.poster}`;
        }
        const url = typeof item === 'string' ? item : (item ? item.link : '');
        const ytId = App.extractYTId(url);
        if (ytId) {
            return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        }
        return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1000&auto=format&fit=crop';
    },

    updateNavButtons: (activeBtn) => {
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(b => b.classList.remove('active'));
        activeBtn.classList.add('active');
    },

    showEmptyState: () => {
        if (App.elements.grid) App.elements.grid.style.display = 'none';
        if (App.elements.noResults) App.elements.noResults.style.display = 'block';
    },

    truncateText: (text, maxLength) => {
        return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
    },

    setupScrollEffect: () => {
        window.addEventListener('scroll', () => {
            if (App.elements.navbar) {
                App.elements.navbar.classList.toggle('scrolled', window.scrollY > 50);
            }
        });
    }
};

// Make App globally accessible for inline event handlers
window.App = App;

// Initialize app
document.addEventListener('DOMContentLoaded', () => App.init());
