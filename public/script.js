/**
 * 🚀 StreamFlix - Frontend V5.0
 * 🎬 Universal Player (m3u8 & MP4) & Categorized Grid
 */

const App = {
    state: {
        data: [],
        favorites: JSON.parse(localStorage.getItem('streamflix_favorites')) || [],
        currentCategory: 'all',
        isLoading: false,
    },

    elements: {
        grid: document.getElementById('moviesGrid'),
        // ... (باقي العناصر كما هي في كودك القديم تماماً)
        skeleton: document.getElementById('skeletonLoader'),
        noResults: document.getElementById('noResults'),
        detailsModal: document.getElementById('detailsModal'),
        detailsImg: document.getElementById('detailsImg'),
        detailsTitle: document.getElementById('detailsTitle'),
        detailsPlayBtn: document.getElementById('detailsPlayBtn'),
        detailsFavBtn: document.getElementById('detailsFavBtn'),
        closeDetailsBtn: document.getElementById('closeDetailsBtn'),
        playerModal: document.getElementById('playerModal'),
        playerTitle: document.getElementById('playerTitle'),
        closePlayerBtn: document.getElementById('closePlayerBtn'),
        videoContainer: document.querySelector('.video-container'),
        toast: document.getElementById('toastNotification')
    },

    playerInstance: null,

    init: async () => {
        App.setupEventListeners();
        await App.fetchData();
    },

    setupEventListeners: () => {
        App.elements.closeDetailsBtn?.addEventListener('click', () => App.closeDetails());
        App.elements.closePlayerBtn?.addEventListener('click', () => App.closePlayer());
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                App.state.currentCategory = filter;
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (filter === 'all') App.renderGrid(App.state.data);
                else if (filter === 'favorites') App.renderGrid(App.state.favorites);
                else App.renderGrid(App.state.data.filter(i => i.category === filter));
            });
        });
    },

    fetchData: async () => {
        try {
            const res = await fetch('/api/content');
            const result = await res.json();
            App.state.data = result.data || [];
            App.renderGrid(App.state.data);
        } catch (error) {
            console.error("Fetch error");
        }
    },

    // جلب الصورة (إذا رفعنا بوستر سيتم سحبه، وإلا سيجلب صورة افتراضية)
    getThumbnail: (item) => {
        if (item.poster) return `/api/image/${item.poster}`;
        return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=500&auto=format&fit=crop'; 
    },

    // التصميم الجديد: أقسام متسلسلة (Netflix Style)
    renderGrid: (items) => {
        if (!App.elements.grid) return;
        App.elements.grid.innerHTML = '';
        
        // تجميع الأفلام حسب التصنيف (أكشن، دراما، إلخ)
        const grouped = items.reduce((acc, item) => {
            const g = item.genre || 'أخرى';
            if (!acc[g]) acc[g] = [];
            acc[g].push(item);
            return acc;
        }, {});

        // جعل الأقسام تظهر تحت بعضها
        App.elements.grid.style.display = 'block';

        for (const [genre, genreItems] of Object.entries(grouped)) {
            const section = document.createElement('div');
            section.className = 'genre-section';
            section.style.marginBottom = '30px';
            
            section.innerHTML = `
                <h2 style="color:white; margin-bottom:15px; border-right: 4px solid #e50914; padding-right: 10px; text-align: right;">${genre}</h2>
                <div class="genre-row" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px;"></div>
            `;
            
            const row = section.querySelector('.genre-row');
            
            genreItems.forEach(item => {
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.style.position = 'relative';
                card.style.cursor = 'pointer';
                card.style.borderRadius = '8px';
                card.style.overflow = 'hidden';
                card.onclick = () => App.openDetails(item);

                card.innerHTML = `
                    <img src="${App.getThumbnail(item)}" style="width:100%; height:200px; object-fit:cover; border-radius:8px;" alt="${item.title}">
                    <div style="position:absolute; bottom:0; width:100%; background:linear-gradient(transparent, #000); padding:20px 10px 10px; text-align:center; color:white; font-size:14px; font-weight:bold;">
                        ${item.title.length > 25 ? item.title.substring(0, 25) + '...' : item.title}
                    </div>
                `;
                row.appendChild(card);
            });
            
            App.elements.grid.appendChild(section);
        }
    },

    openDetails: (item) => {
        if (App.elements.detailsImg) App.elements.detailsImg.src = App.getThumbnail(item);
        if (App.elements.detailsTitle) App.elements.detailsTitle.innerText = item.title;
        
        if (App.elements.detailsPlayBtn) {
            App.elements.detailsPlayBtn.onclick = () => {
                App.closeDetails();
                App.playVideo(item.link, item.title);
            };
        }
        App.elements.detailsModal?.classList.add('show');
    },

    closeDetails: () => {
        App.elements.detailsModal?.classList.remove('show');
    },

    createPlayerContainer: () => {
        if (!App.elements.videoContainer) return null;
        App.elements.videoContainer.innerHTML = '';
        const videoDiv = document.createElement('video');
        videoDiv.id = 'plyr-video';
        videoDiv.className = 'plyr-video-player';
        videoDiv.controls = true;
        App.elements.videoContainer.appendChild(videoDiv);
        return videoDiv;
    },

    // المشغل الخارق لدعم روابط m3u8
    playVideo: (url, title) => {
        if (App.elements.playerTitle) App.elements.playerTitle.innerText = title;
        if (App.elements.playerModal) App.elements.playerModal.style.display = 'flex';
        
        const videoElement = App.createPlayerContainer();
        const isM3U8 = url.toLowerCase().includes('.m3u8');

        // تهيئة Plyr
        App.playerInstance = new Plyr(videoElement, {
            controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen']
        });

        // سحر تشغيل تقنية HLS (m3u8)
        if (isM3U8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(videoElement);
            App.playerInstance.hls = hls; // حفظ النسخة لحذفها عند الإغلاق
        } else {
            // تشغيل MP4 العادي
            videoElement.src = url;
        }
        
        App.playerInstance.play();
    },

    closePlayer: () => {
        if (App.playerInstance) {
            if (App.playerInstance.hls) App.playerInstance.hls.destroy();
            App.playerInstance.destroy();
            App.playerInstance = null;
        }
        if (App.elements.videoContainer) App.elements.videoContainer.innerHTML = '';
        if (App.elements.playerModal) App.elements.playerModal.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
