/**
 * 🛠️ PROJECT: njmflix - The Ultimate Frontend Core
 * 🛡️ ARCHITECTURE: Modular MVC-like Design
 * ✨ FEATURES: LocalStorage Watchlist, Dynamic Hero, Plyr Integration
 */

const App = {
    state: {
        data: [],
        favorites: JSON.parse(localStorage.getItem('njmflix_favorites')) || [],
        currentCategory: 'all'
    },

    elements: {
        grid: document.getElementById('moviesGrid'),
        skeleton: document.getElementById('skeletonLoader'),
        noResults: document.getElementById('noResults'),
        navbar: document.getElementById('navbar'),
        
        // Hero Elements
        heroBanner: document.getElementById('heroBanner'),
        heroTitle: document.getElementById('heroTitle'),
        heroPlayBtn: document.getElementById('heroPlayBtn'),
        heroInfoBtn: document.getElementById('heroInfoBtn'),
        
        // Modal Elements
        detailsModal: document.getElementById('detailsModal'),
        detailsImg: document.getElementById('detailsImg'),
        detailsTitle: document.getElementById('detailsTitle'),
        detailsCategory: document.getElementById('detailsCategory'),
        detailsPlayBtn: document.getElementById('detailsPlayBtn'),
        detailsFavBtn: document.getElementById('detailsFavBtn'),
        
        // Player Elements
        playerModal: document.getElementById('playerModal'),
        playerTitle: document.getElementById('playerTitle')
    },

    playerInstance: null,

    // 1. التهيئة الأساسية (Initialization)
    init: async () => {
        App.setupScrollEffect();
        App.initPlayer();
        await App.fetchData();
    },

    // 2. إعداد مشغل Plyr الاحترافي
    initPlayer: () => {
        App.playerInstance = new Plyr('#plyr-video', {
            controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
            youtube: { 
                noCookie: true, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1, controls: 0
            }
        });
    },

    // 3. جلب البيانات من السيرفر
    fetchData: async () => {
        try {
            const res = await fetch('/api/content');
            const result = await res.json();
            App.state.data = result.data || [];
            
            App.elements.skeleton.style.display = 'none';
            App.elements.grid.style.display = 'grid';
            
            if(App.state.data.length > 0) {
                App.renderHero(App.state.data[0]); // أول عنصر يكون البانر الرئيسي
                App.renderGrid(App.state.data);
            } else {
                App.showEmptyState();
            }
        } catch (error) {
            console.error("Data fetch failed:", error);
            App.elements.skeleton.innerHTML = '<p style="color:red; text-align:center; grid-column:1/-1;">فشل الاتصال بالخوادم، تأكد من تشغيل السيرفر.</p>';
        }
    },

    // 4. استخراج كود يوتيوب (Robust Regex)
    extractID: (url) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    // 5. بناء البانر الرئيسي (Hero Section)
    renderHero: (item) => {
        const ytId = App.extractID(item.link);
        if (!ytId) return;

        const imgUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        App.elements.heroBanner.style.backgroundImage = `url('${imgUrl}')`;
        App.elements.heroTitle.innerText = item.title;

        // إعداد أزرار البانر
        App.elements.heroPlayBtn.onclick = () => App.playVideo(ytId, item.title);
        App.elements.heroInfoBtn.onclick = () => App.openDetails(item);
    },

    // 6. رسم شبكة الأفلام
    renderGrid: (items) => {
        App.elements.grid.innerHTML = '';
        if(items.length === 0) return App.showEmptyState();
        
        App.elements.noResults.style.display = 'none';
        App.elements.grid.style.display = 'grid';

        items.forEach(item => {
            const ytId = App.extractID(item.link);
            if (!ytId) return;

            const card = document.createElement('div');
            card.className = 'movie-card';
            card.onclick = () => App.openDetails(item); // يفتح التفاصيل أولاً وليس المشغل

            card.innerHTML = `
                <img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" loading="lazy">
                <div class="card-overlay">
                    <div class="play-icon-circle"><i class="fa-solid fa-play"></i></div>
                    <h3>${item.title}</h3>
                </div>
            `;
            App.elements.grid.appendChild(card);
        });
    },

    // 7. نافذة التفاصيل (Details Modal)
    openDetails: (item) => {
        const ytId = App.extractID(item.link);
        const isFav = App.state.favorites.some(f => f._id === item._id);

        App.elements.detailsImg.src = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        App.elements.detailsTitle.innerText = item.title;
        App.elements.detailsCategory.innerText = item.category === 'movie' ? 'فيلم' : 'مسلسل';
        
        // إعداد زر المفضلة
        App.elements.detailsFavBtn.innerHTML = isFav ? '<i class="fa-solid fa-check"></i> في قائمتي' : '<i class="fa-solid fa-plus"></i> أضف لقائمتي';
        App.elements.detailsFavBtn.onclick = () => App.toggleFavorite(item);
        
        // زر التشغيل
        App.elements.detailsPlayBtn.onclick = () => {
            App.closeDetails();
            App.playVideo(ytId, item.title);
        };

        App.elements.detailsModal.classList.add('show');
    },

    closeDetails: () => App.elements.detailsModal.classList.remove('show'),

    // 8. نظام المفضلة (Watchlist)
    toggleFavorite: (item) => {
        const index = App.state.favorites.findIndex(f => f._id === item._id);
        if (index > -1) {
            App.state.favorites.splice(index, 1);
            App.elements.detailsFavBtn.innerHTML = '<i class="fa-solid fa-plus"></i> أضف لقائمتي';
        } else {
            App.state.favorites.push(item);
            App.elements.detailsFavBtn.innerHTML = '<i class="fa-solid fa-check"></i> في قائمتي';
        }
        localStorage.setItem('njmflix_favorites', JSON.stringify(App.state.favorites));
        
        // تحديث العرض إذا كنا داخل قسم المفضلة
        if(App.state.currentCategory === 'favorites') App.renderGrid(App.state.favorites);
    },

    // 9. تشغيل الفيديو (الاحتراف الكامل)
    playVideo: (ytId, title) => {
        document.body.style.overflow = 'hidden';
        App.elements.playerTitle.innerText = title;
        App.elements.playerModal.style.display = 'flex';

        App.playerInstance.source = {
            type: 'video',
            sources: [{ src: ytId, provider: 'youtube' }]
        };
        App.playerInstance.play();
    },

    closePlayer: () => {
        document.body.style.overflow = 'auto';
        App.playerInstance.stop();
        App.elements.playerModal.style.display = 'none';
    },

    // 10. الفلترة والتنقل
    filterContent: (type, btn) => {
        App.updateNavButtons(btn);
        App.state.currentCategory = type;
        
        document.getElementById('sectionTitle').innerText = 
            type === 'movie' ? 'أحدث الأفلام' : 
            type === 'series' ? 'أحدث المسلسلات' : 'أضيف حديثاً';

        if(type === 'all') App.renderGrid(App.state.data);
        else App.renderGrid(App.state.data.filter(i => i.category === type));
    },

    showFavorites: (btn) => {
        App.updateNavButtons(btn);
        App.state.currentCategory = 'favorites';
        document.getElementById('sectionTitle').innerText = 'قائمتي المفضلة';
        App.renderGrid(App.state.favorites);
    },

    // 11. محرك البحث الذكي
    handleSearch: (query) => {
        const q = query.toLowerCase().trim();
        const dataSource = App.state.currentCategory === 'favorites' ? App.state.favorites : App.state.data;
        const results = dataSource.filter(i => i.title.toLowerCase().includes(q));
        App.renderGrid(results);
    },

    // --- Helpers ---
    updateNavButtons: (activeBtn) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        activeBtn.classList.add('active');
    },
    
    showEmptyState: () => {
        App.elements.grid.style.display = 'none';
        App.elements.noResults.style.display = 'block';
    },

    setupScrollEffect: () => {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) App.elements.navbar.classList.add('scrolled');
            else App.elements.navbar.classList.remove('scrolled');
        });
    }
};

// تشغيل التطبيق فور اكتمال بناء الصفحة
document.addEventListener('DOMContentLoaded', App.init);
