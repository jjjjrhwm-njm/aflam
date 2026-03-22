/**
 * StreamFlix Pro - Main Logic
 * تم إصلاح مسارات الصور ومنطق العرض
 */

const App = {
    data: [],
    favorites: [],
    token: localStorage.getItem('token'),

    init: async () => {
        console.log("App Initializing...");
        await App.fetchContent();
        
        // إخفاء شاشة التحميل بعد ثانية
        setTimeout(() => {
            const loader = document.getElementById('loadingOverlay');
            if(loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }
        }, 1000);
    },

    fetchContent: async () => {
        try {
            const res = await fetch('/api/content');
            const result = await res.json();
            
            if (result.success && result.data.length > 0) {
                App.data = result.data;
                // إخفاء رسالة "لا توجد نتائج" فوراً
                document.getElementById('noResults').style.display = 'none';
                document.getElementById('moviesGrid').style.display = 'block';
                
                App.renderHero(App.data[0]); // أول فيلم للواجهة
                App.renderSliders(App.data); // البقية في القوائم
            } else {
                App.showEmpty();
            }
        } catch (err) {
            console.error("Fetch Error:", err);
            App.showEmpty();
        }
    },

    renderHero: (item) => {
        const hero = document.getElementById('heroBanner');
        if (!hero) return;

        // استخدام راوت الصور المصلح
        hero.style.backgroundImage = `url('/api/image/${item.poster}')`;
        document.getElementById('heroTitle').innerText = item.title;
        document.getElementById('heroYear').innerText = item.year || '2026';
        document.getElementById('heroDescription').innerText = item.description || 'مشاهدة ممتعة لأحدث الأفلام والمسلسلات حصرياً.';
        
        // زر التشغيل
        document.getElementById('heroPlayBtn').onclick = () => window.location.href = item.link;
    },

    renderSliders: (items) => {
        const grid = document.getElementById('moviesGrid');
        grid.innerHTML = '';

        // تجميع الأفلام حسب التصنيف (Genre)
        const groups = items.reduce((acc, obj) => {
            const key = obj.genre || 'عام';
            if (!acc[key]) acc[key] = [];
            acc[key].push(obj);
            return acc;
        }, {});

        for (const genre in groups) {
            const section = document.createElement('div');
            section.className = 'genre-section';
            section.innerHTML = `
                <h2 class="genre-title">${genre}</h2>
                <div class="slider-container">
                    ${groups[genre].map(movie => `
                        <div class="movie-card" onclick="window.location.href='${movie.link}'">
                            <div class="card-img-wrapper">
                                <img src="/api/image/${movie.poster}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Poster'">
                                <div class="card-overlay">
                                    <i class="fa-solid fa-play"></i>
                                </div>
                            </div>
                            <div class="card-info">
                                <h4>${movie.title}</h4>
                                <span>${movie.isVIP ? '💎 VIP' : '🆓 مجاني'}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            grid.appendChild(section);
        }
    },

    showEmpty: () => {
        document.getElementById('noResults').style.display = 'block';
        document.getElementById('moviesGrid').style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', App.init);
