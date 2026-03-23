// public/js/ui.js
const UI = {
    playerInstance: null,
    isUserVIP: false,

    updateUserStatus(isVIP) {
        this.isUserVIP = isVIP;
        const statusEl = document.getElementById('userStatus');
        if (isVIP) {
            statusEl.textContent = "✅ VIP نشط";
            statusEl.classList.add('vip-active');
        } else {
            statusEl.textContent = "👤 حساب عادي";
            statusEl.classList.remove('vip-active');
        }
    },

    renderHero(movie) {},

    renderMovies(movies, containerId, isVipSection = false) {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; 

        if (movies.length === 0) {
            container.innerHTML = '<p style="color:#aaa; text-align:center;">لا يوجد محتوى حالياً.</p>';
            return;
        }

        movies.forEach(movie => {
            const card = document.createElement('div');
            card.className = 'movie-card';
            
            let cardContent = `
                <img src="/api/content/image/${movie.poster}" alt="${movie.title}" loading="lazy">
                <div class="movie-info">
                    <div class="movie-title">${movie.title}</div>
                </div>
            `;

            if (isVipSection && !this.isUserVIP) {
                cardContent += `
                    <div class="locked-overlay">
                        <span style="font-size:30px;">🔒</span>
                        <span>محتوى مقفل<br>👑 VIP اشترك عبر البوت</span>
                    </div>
                `;
                card.onclick = () => alert("هذا المحتوى حصري لمشتركي VIP. افتح البوت واشترك بـ 100 نجمة لفتحه!");
            } else {
                card.onclick = () => this.openPlayer(movie.link, movie.title);
            }

            card.innerHTML = cardContent;
            container.appendChild(card);
        });
    },

    extractYTId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    // المشغل الذكي Plyr
    openPlayer(url, title) {
        document.getElementById('playerTitle').textContent = title;
        document.getElementById('playerModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        const videoContainer = document.querySelector('.video-wrapper');
        
        // بناء عنصر الفيديو من الصفر في كل مرة لضمان عمل Plyr
        videoContainer.innerHTML = '<video id="plyr-video" playsinline controls crossorigin></video>';
        const videoEl = document.getElementById('plyr-video');

        const ytId = this.extractYTId(url);
        const isM3U8 = url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('.m3u');

        if (ytId) {
            // 1. تشغيل روابط يوتيوب
            this.playerInstance = new Plyr(videoEl, { autoplay: true });
            this.playerInstance.source = {
                type: 'video',
                sources: [{ src: ytId, provider: 'youtube' }]
            };
        } else if (isM3U8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
            // 2. تشغيل روابط البث والسيرفرات الخارجية (M3U8)
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(videoEl);
            this.playerInstance = new Plyr(videoEl, { autoplay: true });
            this.playerInstance.hls = hls; // حفظه لإغلاقه لاحقاً
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoEl.play().catch(() => {});
            });
        } else {
            // 3. تشغيل روابط MP4 المباشرة
            videoEl.src = url;
            this.playerInstance = new Plyr(videoEl, { autoplay: true });
        }
    },

    closePlayer() {
        document.getElementById('playerModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        
        // تدمير المشغل القديم بالكامل لمنع التعليق
        if (this.playerInstance) {
            if (this.playerInstance.hls) {
                this.playerInstance.hls.destroy();
            }
            this.playerInstance.stop();
            this.playerInstance.destroy();
            this.playerInstance = null;
        }
        document.querySelector('.video-wrapper').innerHTML = ''; // تنظيف الحاوية
    }
};

document.getElementById('closePlayerBtn').addEventListener('click', () => UI.closePlayer());
