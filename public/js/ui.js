const UI = {
    playerInstance: null,
    isUserVIP: false,

    // تحديث حالة المستخدم في الأعلى
    updateUserStatus(isVIP) {
        this.isUserVIP = isVIP;
        const statusEl = document.getElementById('userStatus');
        if (isVIP) {
            statusEl.textContent = "👑 حساب VIP نشط";
            statusEl.classList.add('vip-active');
        } else {
            statusEl.textContent = "👤 حساب عادي";
            statusEl.classList.remove('vip-active');
        }
    },

    // تحديث البانر الرئيسي بأول فيلم
    renderHero(movie) {
        if (!movie) return;
        document.getElementById('heroSection').style.backgroundImage = `url('/api/content/image/${movie.poster}')`;
        document.getElementById('heroTitle').textContent = movie.title;
        
        const playBtn = document.getElementById('heroPlayBtn');
        
        // إذا كان الفيلم VIP والمستخدم ليس VIP
        if (movie.isVIP && !this.isUserVIP) {
            document.getElementById('heroType').textContent = "🔒 مقفل (للمشتركين)";
            playBtn.textContent = "⭐️ اشترك الآن للمشاهدة";
            playBtn.onclick = () => alert("يرجى الاشتراك بالنجوم من خلال بوت التلغرام لفتح هذا المحتوى!");
        } else {
            document.getElementById('heroType').textContent = movie.isVIP ? "👑 VIP" : "📢 مجاني";
            playBtn.onclick = () => this.openPlayer(movie.link, movie.title);
        }
    },

    // رسم كروت الأفلام
    renderMovies(movies, containerId, isVipSection = false) {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; // تفريغ القديم

        if (movies.length === 0) {
            container.innerHTML = '<p style="color:#aaa;">لا يوجد محتوى حالياً.</p>';
            return;
        }

        movies.forEach(movie => {
            const card = document.createElement('div');
            card.className = 'movie-card';
            
            let cardContent = `
                <img src="/api/content/image/${movie.poster}" alt="${movie.title}">
                <div class="movie-info">
                    <div class="movie-title">${movie.title}</div>
                </div>
            `;

            // إذا كان الفيلم في قسم VIP والمستخدم ليس مشتركاً، نضع القفل
            if (isVipSection && !this.isUserVIP) {
                cardContent += `
                    <div class="locked-overlay">
                        <span style="font-size:30px;">🔒</span>
                        <span>محتوى مقفل<br>اشترك عبر البوت</span>
                    </div>
                `;
                card.onclick = () => alert("هذا المحتوى حصري لمشتركي VIP. افتح البوت واشترك بـ 100 نجمة!");
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

// تأثير السكرول للشريط العلوي
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
});

// تفعيل زر إغلاق المشغل
document.getElementById('closePlayerBtn').addEventListener('click', () => UI.closePlayer());
