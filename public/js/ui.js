const UI = {
    playerInstance: null,
    isUserVIP: false,

    // تحديث حالة المستخدم في الأعلى
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

    // إخفاء دالة renderHero السابقة لأننا أخفينا البانر
    renderHero(movie) {},

    // رسم كروت الأفلام بشكل شبكي -Grid View- (تصميم الصورة)
    renderMovies(movies, containerId, isVipSection = false) {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; // تفريغ القديم

        if (movies.length === 0) {
            container.innerHTML = '<p style="color:#aaa; text-align:center;">لا يوجد محتوى حالياً.</p>';
            return;
        }

        movies.forEach(movie => {
            const card = document.createElement('div');
            card.className = 'movie-card';
            
            // تصميم كارت يشبه الصورة المرفقة، مع العنوان في شريط شفاف أسفل الصورة
            let cardContent = `
                <img src="/api/content/image/${movie.poster}" alt="${movie.title}" loading="lazy">
                <div class="movie-info">
                    <div class="movie-title">${movie.title}</div>
                </div>
            `;

            // قفل الـ VIP
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

    // تشغيل الفيديو
    openPlayer(url, title) {
        document.getElementById('playerTitle').textContent = title;
        document.getElementById('playerModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        const videoEl = document.getElementById('plyr-video');
        videoEl.src = url;
        
        if (!this.playerInstance) {
            this.playerInstance = new Plyr(videoEl, { autoplay: true });
        } else {
            this.playerInstance.source = { type: 'video', sources: [{ src: url }] };
            this.playerInstance.play();
        }
    },

    // إغلاق الفيديو
    closePlayer() {
        document.getElementById('playerModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        if (this.playerInstance) {
            this.playerInstance.stop();
        }
    }
};

// تفعيل زر إغلاق المشغل
document.getElementById('closePlayerBtn').addEventListener('click', () => UI.closePlayer());
