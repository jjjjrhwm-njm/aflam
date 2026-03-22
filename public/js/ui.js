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

    // دالة لاستخراج ID اليوتيوب إذا كان الرابط من يوتيوب
    extractYTId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    // المشغل الذكي
    openPlayer(url, title) {
        document.getElementById('playerTitle').textContent = title;
        document.getElementById('playerModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        const videoContainer = document.querySelector('.video-wrapper');
        videoContainer.innerHTML = ''; // تنظيف المشغل القديم

        // إنشاء عنصر الفيديو الجديد
        const videoEl = document.createElement('video');
        videoEl.id = 'plyr-video';
        videoEl.className = 'plyr-video-player';
        videoEl.controls = true;
        videoEl.setAttribute('playsinline', '');
        videoContainer.appendChild(videoEl);

        const ytId = this.extractYTId(url);
        const isM3U8 = url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('.m3u');

        const playerConfig = {
            controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
            autoplay: true
        };

        if (ytId) {
            // تشغيل يوتيوب
            playerConfig.youtube = { noCookie: false, rel: 0, showinfo: 0, iv_load_policy: 3 };
            this.playerInstance = new Plyr(videoEl, playerConfig);
            this.playerInstance.source = { type: 'video', sources: [{ src: ytId, provider: 'youtube' }] };
        } else {
            // تشغيل الروابط العادية و m3u8
            this.playerInstance = new Plyr(videoEl, playerConfig);
            if (isM3U8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(videoEl);
                this.playerInstance.hls = hls; // تخزين مرجع لتدميره لاحقاً
                this.playerInstance.on('ready', () => this.playerInstance.play());
            } else {
                videoEl.src = url;
                this.playerInstance.on('ready', () => this.playerInstance.play());
            }
        }
    },

    closePlayer() {
        document.getElementById('playerModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        
        if (this.playerInstance) {
            if (this.playerInstance.hls) {
                this.playerInstance.hls.destroy(); // إيقاف التحميل في الخلفية
            }
            this.playerInstance.stop();
            this.playerInstance.destroy(); // تدمير المشغل بالكامل لتجنب التعليق
            this.playerInstance = null;
        }
        document.querySelector('.video-wrapper').innerHTML = ''; // تفريغ الحاوية
    }
};

document.getElementById('closePlayerBtn').addEventListener('click', () => UI.closePlayer());
