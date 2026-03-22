const App = {
    data: [],
    favorites: [],
    currentFilter: 'all',
    currentGenre: 'all',
    searchQuery: '',
    token: localStorage.getItem('token'),
    user: null,

    init: async () => {
        if (App.token) {
            try {
                const userStr = localStorage.getItem('user');
                App.user = userStr ? JSON.parse(userStr) : null;
            } catch(e) {}
        }
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
                if (filter === 'favorites') {
                    App.currentFilter = 'favorites';
                    App.renderFavorites();
                } else if (filter === 'all' || filter === 'movie' || filter === 'series') {
                    App.currentFilter = filter;
                    App.currentGenre = 'all';
                    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
                    document.querySelector('.cat-tab[data-genre="all"]').classList.add('active');
                    App.filterContent();
                } else if (filter === undefined && btn.id === 'vipBtn') {
                    // توجيه إلى صفحة VIP
                    if (!App.token) {
                        alert('يرجى تسجيل الدخول أولاً');
                        window.location.href = '/login';
                    } else if (!App.user?.isVIP) {
                        alert('هذا المحتوى للأعضاء VIP فقط');
                    } else {
                        window.location.href = '/vip';
                    }
                    return;
                }
                document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('mobileMenu')?.classList.remove('active');
            });
        });
        // نفس باقي الأحداث (بحث، تبويبات، قائمة المستخدم، القائمة الجوالة) مثل VIP
        // ... (نفس الكود ولكن بدون تكرار)
    },

    fetchContent: async () => {
        try {
            const res = await fetch('/api/content');
            const result = await res.json();
            if (result.success) {
                App.data = result.data;
                App.renderSliders();
            }
        } catch (err) { console.error(err); }
    },

    filterContent: () => {
        let filtered = App.data;
        if (App.currentFilter !== 'all') filtered = filtered.filter(item => item.category === App.currentFilter);
        if (App.currentGenre !== 'all') filtered = filtered.filter(item => item.genre === App.currentGenre);
        if (App.searchQuery) filtered = filtered.filter(item => item.title.includes(App.searchQuery));
        App.renderSliders(filtered);
    },

    renderSliders: (items = null) => {
        // نفس دالة renderSliders في vip-script.js لكن بدون إضافة "VIP" في العنوان
    },

    // باقي الدوال مشابهة لـ vip-script.js ولكن endpoints عامة بدون مصادقة
    // (playVideo, openDetails, toggleFavorite, loadFavorites, etc.)
};

document.addEventListener('DOMContentLoaded', () => App.init());
