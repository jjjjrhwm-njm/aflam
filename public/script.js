/**
 * njmflix Logic Core V4.0
 * Deep path tracking and Dynamic Rendering
 */

const state = {
    allContent: [],
    filteredContent: []
};

const ui = {
    grid: document.getElementById('movieGrid'),
    loader: document.getElementById('loadingState'),
    player: document.getElementById('masterPlayer'),
    iframe: document.getElementById('globalIframe'),
    titleDisplay: document.getElementById('videoTitleDisplay'),

    showLoader: (show) => ui.loader.style.display = show ? 'block' : 'none',
    
    openPlayer: (id, title) => {
        // منع التمرير في الخلفية
        document.body.style.overflow = 'hidden';
        ui.titleDisplay.innerText = title;
        
        // بناء رابط يوتيوب "نظيف" بقدر الإمكان قبل تقنية القص
        const cleanURL = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&controls=1&showinfo=0&disablekb=1&fs=0`;
        
        ui.iframe.src = cleanURL;
        ui.player.style.display = 'flex';
    },

    closePlayer: () => {
        document.body.style.overflow = 'auto';
        ui.iframe.src = '';
        ui.player.style.display = 'none';
    }
};

const logic = {
    // جلب البيانات من السيرفر (Path: /api/content)
    init: async () => {
        try {
            const response = await fetch('/api/content');
            const result = await response.json();
            
            // التعامل مع الـ Lean Object المرسل من السيرفر V4
            state.allContent = result.data || [];
            ui.showLoader(false);
            logic.render(state.allContent);
        } catch (error) {
            console.error('Core Logic Failure:', error);
            ui.loader.innerHTML = '<p style="color:red">فشل الاتصال بالنظام السحابي.</p>';
        }
    },

    // معالجة الروابط واستخراج الـ ID
    parseYoutubeId: (url) => {
        const regex = /(?:v=|be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    // رسم البطاقات في الواجهة
    render: (items) => {
        ui.grid.innerHTML = '';
        items.forEach(item => {
            const ytId = logic.parseYoutubeId(item.link);
            if (!ytId) return;

            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => ui.openPlayer(ytId, item.title);
            
            card.innerHTML = `
                <img src="https://img.youtube.com/vi/${ytId}/maxresdefault.jpg" 
                     onerror="this.src='https://img.youtube.com/vi/${ytId}/hqdefault.jpg'" 
                     loading="lazy">
                <div class="card-meta">
                    <p class="card-title">${item.title}</p>
                </div>
            `;
            ui.grid.appendChild(card);
        });
    },

    // نظام البحث الفوري
    search: (query) => {
        const q = query.toLowerCase();
        const results = state.allContent.filter(i => 
            i.title.toLowerCase().includes(q)
        );
        logic.render(results);
    },

    // نظام الفلترة (أفلام/مسلسلات)
    filter: (category, btn) => {
        // تحديث شكل الأزرار
        document.querySelectorAll('.cat-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (category === 'all') {
            logic.render(state.allContent);
        } else {
            const results = state.allContent.filter(i => i.category === category);
            logic.render(results);
        }
    }
};

// بدء تشغيل المحرك
window.onload = logic.init;
